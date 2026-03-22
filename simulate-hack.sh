#!/bin/bash
#
# Simulate a hacked WordPress site for security scanner testing.
#
# This script:
# 1. Plants suspicious options in wp_options (eval, base64, inline script)
# 2. Creates a rogue administrator account
# 3. Creates a fake malicious PHP file in wp-content/plugins/
# 4. Modifies wp-login.php to trigger a core checksum mismatch
#
# Usage: bash simulate-hack.sh
# Run from Local's site shell (Open Site Shell in Local app).

set -e

# Navigate to the WordPress root (ABSPATH).
# Detect it via WP-CLI, fall back to walking up from the script directory.
if command -v wp &>/dev/null; then
    WP_ROOT="$(wp eval 'echo ABSPATH;' 2>/dev/null)" || true
fi

if [ -z "$WP_ROOT" ] || [ ! -f "$WP_ROOT/wp-login.php" ]; then
    # Walk up from the script's location until we find wp-login.php.
    WP_ROOT="$(cd "$(dirname "$0")" && pwd)"
    while [ "$WP_ROOT" != "/" ] && [ ! -f "$WP_ROOT/wp-login.php" ]; do
        WP_ROOT="$(dirname "$WP_ROOT")"
    done
fi

if [ ! -f "$WP_ROOT/wp-login.php" ]; then
    echo "[!] Could not locate WordPress root. Run this script from within your WP install."
    exit 1
fi

cd "$WP_ROOT"
echo "WordPress root: $WP_ROOT"
echo ""

echo "============================================"
echo "  Simulating hacked WordPress site"
echo "  (for wp-agentic-admin scanner testing)"
echo "============================================"
echo ""

# --- Step 1: Plant suspicious options ---
echo "--- Step 1: Planting suspicious options ---"
echo ""

wp option update wp_session_manager_x 'eval(base64_decode("ZWNobyAiaGFja2VkIjs="));'
echo "[+] Created option 'wp_session_manager_x' with eval() payload"

wp option update wp_cache_config_bak '$code = base64_decode("ZnVuY3Rpb24gZ2V0X3NoZWxsKCkgeyByZXR1cm4gImZha2UiOyB9"); include($code);'
echo "[+] Created option 'wp_cache_config_bak' with base64_decode payload"

wp option update widget_display_override '<script>document.write(String.fromCharCode(60,115,99,114,105,112,116))</script>'
echo "[+] Created option 'widget_display_override' with inline script"
echo ""

# --- Step 2: Create rogue admin account ---
echo "--- Step 2: Creating rogue admin account ---"
echo ""

if wp user get eviluser@leet.com --field=ID 2>/dev/null; then
    echo "[*] Evil user 'eviluser@leet.com' already exists"
else
    wp user create eviluser eviluser@leet.com --role=administrator --user_pass=h4ck3d123
    echo "[+] Created administrator account 'eviluser' (eviluser@leet.com)"
fi
echo ""

# --- Step 3: Create a fake malicious PHP file ---
echo "--- Step 3: Creating fake backdoor file ---"
echo ""

BACKDOOR_DIR="wp-content/plugins/totally-legit-seo"
mkdir -p "$BACKDOOR_DIR"

cat > "$BACKDOOR_DIR/helper.php" << 'EOPHP'
<?php
/**
 * Plugin Name: Totally Legit SEO Helper
 * Description: Just an ordinary SEO helper. Nothing to see here.
 * Version: 1.0.0
 */

// Definitely not suspicious at all.
$encoded = "ZWNobyAiVGhpcyBpcyBhIGZha2UgbWFsd2FyZSBwYXlsb2FkIGZvciB0ZXN0aW5nIHB1cnBvc2VzIG9ubHkuIjs=";
$decoded = base64_decode( $encoded );
eval( $decoded );

// The decoded string is just: echo "This is a fake malware payload for testing purposes only.";
EOPHP

echo "[+] Created $BACKDOOR_DIR/helper.php (fake eval+base64 backdoor)"
echo ""

# --- Step 4: Modify wp-login.php to fail core checksum ---
echo "--- Step 4: Modifying wp-login.php (checksum mismatch) ---"
echo ""

if [ -f "wp-login.php" ]; then
    if [ ! -f "wp-login.php.bak" ]; then
        cp wp-login.php wp-login.php.bak
        echo "[+] Backed up wp-login.php to wp-login.php.bak"
    fi

    if ! grep -q 'SIMULATED_HACK_MARKER' wp-login.php; then
        echo '' >> wp-login.php
        echo '// SIMULATED_HACK_MARKER' >> wp-login.php
        echo '$_simulated_hack_gibberish = "aGFja2VkX2J5X3NjcmlwdF9raWRkaWVz";' >> wp-login.php
        echo "[+] Modified wp-login.php (appended gibberish variable)"
    else
        echo "[*] wp-login.php already modified"
    fi
else
    echo "[!] wp-login.php not found — skipping"
fi

echo ""
echo "============================================"
echo "  Hack simulation complete!"
echo ""
echo "  What was planted:"
echo "  - 3 suspicious options in wp_options"
echo "    (eval, base64_decode, inline script)"
echo "  - Admin account: eviluser@leet.com"
echo "  - Backdoor: $BACKDOOR_DIR/helper.php"
echo "  - Modified: wp-login.php (checksum fail)"
echo "============================================"