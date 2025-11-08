// Supabase Edge Function: Verify Password
// This keeps the password secure on the server side

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const APP_PASSWORD = Deno.env.get("APP_PASSWORD") || "";

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const { password, username } = await req.json();
    const APP_USERNAME = Deno.env.get("APP_USERNAME") || "";

    // Verify username (if configured)
    if (APP_USERNAME && username?.toLowerCase() !== APP_USERNAME.toLowerCase()) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid credentials" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Verify password
    if (password === APP_PASSWORD) {
      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    } else {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid credentials" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});

