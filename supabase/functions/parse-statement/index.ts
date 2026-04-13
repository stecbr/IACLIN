import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { fileUrl, fileType } = await req.json();
    if (!fileUrl) throw new Error("fileUrl is required");

    const systemPrompt = `You are a financial document parser for a dental clinic management system.
Analyze the uploaded bank statement and extract ALL transactions you can find. Be thorough - do not skip any.

For each transaction, return:
- description: the description/memo of the transaction
- amount: the absolute numeric value (always positive)
- date: the date in YYYY-MM-DD format
- type: "income" if money received (crédito), "expense" if money paid out (débito)

Return ONLY a JSON array of transactions. No other text.
Example: [{"description":"Pagamento consulta","amount":250.00,"date":"2024-03-01","type":"income"}]

IMPORTANT: Extract EVERY single transaction from the document. Do not summarize or skip any rows.
If you cannot parse the document or it's not a financial statement, return an empty array [].`;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
    ];

    // Download the file and send as inline base64 data
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      throw new Error(`Failed to download file: ${fileResponse.status}`);
    }
    const fileBytes = new Uint8Array(await fileResponse.arrayBuffer());
    const fileBase64 = base64Encode(fileBytes);

    const detectedMime = fileType || "application/pdf";
    const isImage = detectedMime.startsWith("image/");

    if (isImage) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: "Extract ALL transactions from this bank statement image. Do not skip any row." },
          { type: "image_url", image_url: { url: `data:${detectedMime};base64,${fileBase64}` } },
        ],
      });
    } else {
      // PDF - send as inline document via image_url with pdf mime
      messages.push({
        role: "user",
        content: [
          { type: "text", text: "Extract ALL transactions from this bank statement PDF. Be thorough - extract every single transaction row. Do not skip any." },
          { type: "image_url", image_url: { url: `data:application/pdf;base64,${fileBase64}` } },
        ],
      });
    }

    console.log(`Sending ${isImage ? 'image' : 'PDF'} to AI, size: ${fileBytes.length} bytes`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        tools: [
          {
            type: "function",
            function: {
              name: "extract_transactions",
              description: "Extract transactions from a bank statement",
              parameters: {
                type: "object",
                properties: {
                  transactions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        description: { type: "string" },
                        amount: { type: "number" },
                        date: { type: "string", description: "YYYY-MM-DD format" },
                        type: { type: "string", enum: ["income", "expense"] },
                      },
                      required: ["description", "amount", "date", "type"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["transactions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_transactions" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings > Workspace > Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract from tool call response
    let transactions = [];
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        transactions = parsed.transactions ?? [];
      } catch {
        // Fallback: try parsing content directly
        const content = data.choices?.[0]?.message?.content ?? "";
        const match = content.match(/\[[\s\S]*\]/);
        if (match) transactions = JSON.parse(match[0]);
      }
    }

    console.log(`Extracted ${transactions.length} transactions`);

    return new Response(JSON.stringify({ transactions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-statement error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
