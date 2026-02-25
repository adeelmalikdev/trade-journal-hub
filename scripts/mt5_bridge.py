#!/usr/bin/env python3
"""
MT5 Trade Bridge — Fetches trades from MetaTrader 5 and pushes them to your journal app.

Requirements:
  pip install MetaTrader5 requests

Usage:
  1. Edit the CONFIG section below with your credentials
  2. Make sure MT5 terminal is running on this machine
  3. Run: python mt5_bridge.py

For auto-sync, use Windows Task Scheduler or cron to run this periodically.
"""

import MetaTrader5 as mt5
import requests
import json
import sys
from datetime import datetime, timedelta, timezone

# ╔══════════════════════════════════════════════════════════════╗
# ║                    CONFIG — EDIT THESE                       ║
# ╚══════════════════════════════════════════════════════════════╝

# Your app URL (the Supabase project URL)
SUPABASE_URL = "https://tntieplnvvheiqvowjbg.supabase.co"

# Your login email and password for the journal app
APP_EMAIL = "your-email@example.com"
APP_PASSWORD = "your-password"

# The broker_account_id from the app (find it in broker settings)
BROKER_ACCOUNT_ID = "your-broker-account-uuid"

# MT5 account credentials (if you want to log in programmatically)
# Leave as None to use the currently logged-in MT5 terminal
MT5_LOGIN = None        # e.g., 12345678
MT5_PASSWORD = None     # e.g., "mypassword"
MT5_SERVER = None       # e.g., "MetaQuotes-Demo"

# How many days back to fetch trades (on first run)
DAYS_BACK = 30

# ╔══════════════════════════════════════════════════════════════╗
# ║                    END CONFIG                                ║
# ╚══════════════════════════════════════════════════════════════╝

EDGE_FUNCTION_URL = f"{SUPABASE_URL}/functions/v1/trade-push"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRudGllcGxudnZoZWlxdm93amJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjQzMjUsImV4cCI6MjA4NzYwMDMyNX0.6DIjACMPaWO2Zq_Ptbb-bdE_ReywVRMyGIMbT-kstwA"


def authenticate():
    """Sign in to the app and get an access token."""
    print(f"🔑 Authenticating as {APP_EMAIL}...")
    res = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={
            "apikey": ANON_KEY,
            "Content-Type": "application/json",
        },
        json={"email": APP_EMAIL, "password": APP_PASSWORD},
    )
    if res.status_code != 200:
        print(f"❌ Auth failed: {res.text}")
        sys.exit(1)
    token = res.json()["access_token"]
    print("✅ Authenticated successfully")
    return token


def connect_mt5():
    """Initialize and optionally login to MT5."""
    print("📡 Connecting to MT5 terminal...")
    if not mt5.initialize():
        print(f"❌ MT5 initialize failed: {mt5.last_error()}")
        sys.exit(1)

    if MT5_LOGIN and MT5_PASSWORD and MT5_SERVER:
        if not mt5.login(MT5_LOGIN, password=MT5_PASSWORD, server=MT5_SERVER):
            print(f"❌ MT5 login failed: {mt5.last_error()}")
            mt5.shutdown()
            sys.exit(1)

    info = mt5.account_info()
    if info is None:
        print(f"❌ Could not get account info: {mt5.last_error()}")
        mt5.shutdown()
        sys.exit(1)

    print(f"✅ Connected to {info.server} | Account: {info.login} | Balance: {info.balance} {info.currency}")
    return info


def fetch_trades(days_back=DAYS_BACK):
    """Fetch closed deals from MT5 and match them into round-trip trades."""
    now = datetime.now(timezone.utc)
    from_date = now - timedelta(days=days_back)

    deals = mt5.history_deals_get(from_date, now)
    if deals is None or len(deals) == 0:
        print("ℹ️  No deals found in the specified period")
        return []

    print(f"📊 Found {len(deals)} raw deals, matching into trades...")

    # Group deals by position_id
    positions = {}
    for deal in deals:
        # Skip balance operations, commissions, etc.
        if deal.type > 1:  # 0=Buy, 1=Sell
            continue
        if deal.entry == 0 and deal.profit == 0 and deal.volume == 0:
            continue

        pos_id = str(deal.position_id)
        if pos_id not in positions:
            positions[pos_id] = []
        positions[pos_id].append(deal)

    trades = []
    for pos_id, pos_deals in positions.items():
        entries = [d for d in pos_deals if d.entry == 0]  # DEAL_ENTRY_IN
        exits = [d for d in pos_deals if d.entry == 1]    # DEAL_ENTRY_OUT

        if not entries or not exits:
            continue

        entry = entries[0]
        exit_deal = exits[-1]

        total_profit = sum(d.profit for d in pos_deals)
        total_fees = sum(abs(d.commission) + abs(d.swap) for d in pos_deals)

        trades.append({
            "broker_trade_id": f"mt5_{pos_id}",
            "symbol": entry.symbol,
            "direction": "Long" if entry.type == 0 else "Short",  # 0=Buy, 1=Sell
            "entry_time": datetime.fromtimestamp(entry.time, tz=timezone.utc).isoformat(),
            "entry_price": entry.price,
            "exit_time": datetime.fromtimestamp(exit_deal.time, tz=timezone.utc).isoformat(),
            "exit_price": exit_deal.price,
            "position_size": entry.volume,
            "total_fees": round(total_fees, 2),
            "pnl": round(total_profit - total_fees, 2),
        })

    print(f"✅ Matched {len(trades)} round-trip trades")
    return trades


def push_trades(token, trades):
    """Push matched trades to the journal app."""
    if not trades:
        print("ℹ️  No trades to push")
        return

    # Send in batches of 100
    batch_size = 100
    total_ingested = 0
    total_duplicates = 0

    for i in range(0, len(trades), batch_size):
        batch = trades[i : i + batch_size]
        print(f"📤 Pushing batch {i // batch_size + 1} ({len(batch)} trades)...")

        res = requests.post(
            EDGE_FUNCTION_URL,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "apikey": ANON_KEY,
            },
            json={
                "broker_account_id": BROKER_ACCOUNT_ID,
                "trades": batch,
            },
        )

        if res.status_code != 200:
            print(f"❌ Push failed: {res.text}")
            continue

        data = res.json()
        total_ingested += data.get("trades_ingested", 0)
        total_duplicates += data.get("duplicates_skipped", 0)

        if data.get("errors"):
            for err in data["errors"]:
                print(f"  ⚠️  {err}")

    print(f"\n{'='*50}")
    print(f"✅ Done! Ingested: {total_ingested} | Duplicates skipped: {total_duplicates}")
    print(f"{'='*50}")


def main():
    # Step 1: Authenticate with the app
    token = authenticate()

    # Step 2: Connect to MT5
    account_info = connect_mt5()

    try:
        # Step 3: Fetch trades from MT5
        trades = fetch_trades()

        # Step 4: Push trades to the app
        push_trades(token, trades)
    finally:
        mt5.shutdown()
        print("📡 MT5 connection closed")


if __name__ == "__main__":
    main()
