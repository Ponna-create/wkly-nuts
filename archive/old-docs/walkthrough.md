# 🕵️ How to Verify: Price History & Volatility

You asked: *"How do I know this is implemented?"*
Follow these 3 simple steps to see the new "Intelligence Layer" in action.

## Step 1: The "Storekeeper" Test (Vendor Page)
1.  Open your App and go to **Vendor Management**.
2.  **Edit** an existing vendor (or create a dummy one).
3.  Find an ingredient (e.g., "Almonds") that has a price.
    *   *Note the old price (e.g., ₹500).*
4.  **Change the Price** to something else (e.g., ₹600).
5.  Click **"Update Vendor"**.
6.  **The Proof**: Look at the ingredient list again. You will see a small **Clock/History Icon** (🕒) next to the price.
7.  **Click the Icon**: A modal will pop up showing:
    *   Date: Today
    *   Price: ₹600
    *   Change: <span style="color:red">+100</span>

## Step 2: The "Business Owner" Test (Pricing Page)
1.  Go to **Pricing Strategy**.
2.  Select any SKU.
3.  Scroll down to the **Cost Breakdown** section.
4.  **The Proof**: You will see a **NEW ORANGE BOX** called "Volatility Buffer".
    *   *This box did not exist before.*
5.  Type a value (e.g., ₹5.00).
6.  Watch the **Total Cost** and **Profit Margin** recalculate automatically to include this safety buffer.

## Step 3: Technical Check (Supabase)
If you want to see the raw data:
1.  Go to your Supabase Dashboard -> Table Editor.
2.  Look for a new table called `price_history`.
3.  If you see row entries there, the backend is working perfectly!

---

> [!TIP]
> **Don't see the History Icon?**
> Make sure you actually changed the price by more than ₹0.01. The system ignores tiny changes to save space.

## 💡 How This Data Helps You (Business Value)
You asked: *"Where do we visualize this?"*
1.  **Visual Check**: The **History Icon** on the Vendor Page is your quick check. "Is Almonds getting expensive?" -> Click icon -> See the trend.
2.  **Safety Net**: The real power is in the **Pricing Strategy Page**.
    *   Previously, you guessed the safety margin.
    *   Now, you can check the history, see that Almonds fluctuate by 15%, and set a **"Volatility Buffer"** of ₹20.
    *   **Result**: You don't lose money when prices go up next week.

## 📥 Downloading Data
Currently, this is a **Dashboard View**.
*   **Export**: We haven't built a "Download Excel" button for history yet. (We can add this later if you need to send reports to investors).
*   **Database**: The raw data is stored in your private Database Table `price_history`.

