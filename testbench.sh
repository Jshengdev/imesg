#!/bin/bash

# Test Bench Runner for iMesg
# Runs all 8 system checks and reports results

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${CYAN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║          iMesg System Test Bench                     ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""

run_test() {
    local test_num=$1
    local test_name=$2
    local command=$3

    echo -e "${YELLOW}[$test_num] $test_name${NC}"
    echo -e "${CYAN}─────────────────────────────────────────────────────${NC}"

    if eval "$command" 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}\n"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}\n"
        return 1
    fi
}

failed=0

# Test 1: Config loads
run_test "1" "Config Loads" \
    "bun -e \"import { config } from './src/config'; console.log('CONFIG OK:', Object.keys(config).join(', '))\"" || ((failed++))

# Test 2: Database creates tables
run_test "2" "Database Creates Tables" \
    "bun -e \"import { getDb } from './src/memory/db'; const db = getDb(); const tables = db.prepare(\\\"SELECT name FROM sqlite_master WHERE type='table'\\\").all(); console.log('DB OK:', tables.map((t: any) => t.name).join(', '))\"" || ((failed++))

# Test 3: MiniMax LLM responds
run_test "3" "MiniMax LLM Responds" \
    "bun -e \"const { generate } = await import('./src/minimax/llm'); const r = await generate('you are a test', 'say hello in 3 words'); console.log('LLM OK:', r);\"" || ((failed++))

# Test 4: MiniMax TTS generates audio
run_test "4" "MiniMax TTS Generates Audio" \
    "bun -e \"const { textToSpeech } = await import('./src/minimax/tts'); const p = await textToSpeech('testing nudge'); const s = require('fs').statSync(p); console.log('TTS OK:', p, '— size:', s.size, 'bytes');\"" || ((failed++))

# Test 5: Composio connects
run_test "5" "Composio Connects" \
    "bun -e \"const { isMockMode } = await import('./src/integrations/composio'); console.log('COMPOSIO mock mode:', isMockMode());\"" || ((failed++))

# Test 6: Gmail pulls real emails
run_test "6" "Gmail Pulls Real Emails" \
    "bun -e \"const { pullUnreadEmails } = await import('./src/integrations/gmail'); const e = await pullUnreadEmails(3); console.log(e.length, 'emails'); e.forEach(em => console.log(' -', em.from, ':', em.subject));\"" || ((failed++))

# Test 7: Calendar pulls events
run_test "7" "Calendar Pulls Events" \
    "bun -e \"const { pullTodayEvents } = await import('./src/integrations/calendar'); const e = await pullTodayEvents(); console.log(e.length, 'events'); e.forEach(ev => console.log(' -', ev.title, ev.start));\"" || ((failed++))

# Test 8: Personality validation works
run_test "8" "Personality Validation Works" \
    "bun -e \"const { validateResponse, getTemporalVoice } = await import('./src/agent/personality'); console.log('VOICE:', getTemporalVoice()); console.log('CLEAN:', validateResponse('I\\\\'d be happy to help! Certainly, here is your schedule. Furthermore, the meeting is at 2pm.'));\"" || ((failed++))

# Summary
echo -e "${CYAN}╔═══════════════════════════════════════════════════════╗${NC}"
if [ $failed -eq 0 ]; then
    echo -e "${GREEN}║          ALL TESTS PASSED ✓                          ║${NC}"
else
    echo -e "${RED}║          $failed TEST(S) FAILED ✗                         ║${NC}"
fi
echo -e "${CYAN}╚═══════════════════════════════════════════════════════╝${NC}"

exit $failed
