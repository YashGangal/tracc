"""Rule-based conversational layer for the Tracc copilot.

Classifies short, non-operational messages (greetings, thanks, identity, ...)
so they get warm, ChatGPT-style replies WITHOUT touching SQL tools, RAG, or
the agent. Anything operational falls through to the normal pipelines.

Operational check runs FIRST: a message like "hi, how many loads are delayed?"
contains logistics signals and must route to the data layer, not to small talk.
"""

import re
from typing import Optional

GREETING = "greeting"
FAREWELL = "farewell"
THANKS = "thanks"
HELP = "help"
IDENTITY = "identity"
STATUS = "status"
ACK = "acknowledge"
OPERATIONAL = "operational"

CHITCHAT_INTENTS = {GREETING, FAREWELL, THANKS, HELP, IDENTITY, STATUS, ACK}

# Any of these (word-bounded) means the message is about operations,
# even if it opens with "hi" or ends with "thanks".
_OPERATIONAL_RE = re.compile(
    r"\b(loads?|carriers?|drivers?|trucks?|shipments?|deliver\w*|delay\w*|"
    r"late|risk\w*|revenue|kpis?|alerts?|sop|procedures?|protocols?|"
    r"detention|reefer|hos|compliance|invoices?|routes?|lanes?|dispatch\w*|"
    r"fleet|on-?time|otd|predict\w*|sql|reports?|dashboard|L\d+)\b",
    re.IGNORECASE,
)

# Leading patterns are intentionally unanchored at the end: the operational
# check above runs first, so "thanks, now show delayed loads" still routes
# to data. \b guards ("thanksgiving", "history", "oklahoma") stay intact.
_PATTERNS = [
    (GREETING, [
        r"^(hi|hello|hey|yo|hiya|howdy|sup)\b",
        r"^he+y+\b",
        r"^hi+\b",
        r"^good\s?(morning|afternoon|evening|day)\b",
        r"^(hi|hello|hey)\s+(there|tracc)\b",
    ]),
    (FAREWELL, [
        r"^(bye|goodbye|good\s?night|see\s?you|cya)\b",
        r"^have\s?a\s?good\s?(day|night|one)\b",
    ]),
    (THANKS, [
        r"^(thanks?|thank\s?you|thx)\b",
        r"^much\s?appreciated\b",
        r"^appreciated\b",
    ]),
    (HELP, [
        r"\bwhat\s+can\s+you\s+do\b",
        r"\bhow\s+do\s+i\s+use\b",
        r"\bhelp\b",
        r"\bcapabilit",
        r"\bgetting\s+started\b",
        r"\bwhat\s+is\s+this\b",
    ]),
    (IDENTITY, [
        r"\bwho\s+are\s+you\b",
        r"\b(your|ur)\s+name\b",
        r"\bwhat\s+are\s+you\b",
        r"\babout\s+yourself\b",
        r"\btell\s+me\s+about\s+yourself\b",
    ]),
    (STATUS, [
        r"\bhow\s+are\s+you\b",
        r"\bhow('s| is)\s+it\s+going\b",
    ]),
    (ACK, [
        r"^(ok|okay|k|cool|great|nice|got\s?it|understood|sounds\s?good|perfect)\b",
    ]),
]


def classify_intent(query: str) -> str:
    """Return a chitchat intent, or OPERATIONAL for anything data-related."""
    q = (query or "").strip()
    if not q:
        return OPERATIONAL
    if _OPERATIONAL_RE.search(q):
        return OPERATIONAL
    lowered = q.lower()
    if len(lowered) > 120:
        return OPERATIONAL
    for intent, patterns in _PATTERNS:
        for pat in patterns:
            if re.search(pat, lowered):
                return intent
    return OPERATIONAL


def is_chitchat(query: str) -> bool:
    return classify_intent(query) in CHITCHAT_INTENTS


def chitchat_reply(intent: str, user_name: Optional[str] = None) -> str:
    """Warm, Tracc-persona reply. Deterministic — works with no LLM keys."""
    name = f" {user_name.split()[0]}" if user_name else ""
    if intent == GREETING:
        return (
            f"Hey{name}! I'm **Tracc**, your AI dispatch copilot. "
            "Ask me about loads, delays, carriers, drivers, or SOPs — "
            'for example, *"Which loads are delayed right now?"*'
        )
    if intent == FAREWELL:
        return (
            f"Goodbye{name}! I'll keep an eye on the freight while you're away. "
            "Ping me anytime."
        )
    if intent == THANKS:
        return (
            f"Anytime{name}! Keeping freight moving is what I'm here for. "
            "Anything else you need?"
        )
    if intent == HELP:
        return (
            "Here's what I can do for you:\n\n"
            "- **Track freight** — *\"Where is load L14520?\"*, *\"Show me delayed loads\"*\n"
            "- **Check people & carriers** — *\"How is driver Garcia doing?\"*, *\"Which carrier performs worst?\"*\n"
            "- **Predict risk** — *\"Which loads are at risk of delay?\"* (with plain-English reasons)\n"
            "- **Answer procedures** — *\"What's the breakdown protocol?\"* (cited from official SOPs)\n"
            "- **Just chat** — say hi, ask who I am, or think out loud. "
            "Just ask in plain words."
        )
    if intent == IDENTITY:
        return (
            "I'm **Tracc** — the AI operations copilot for this freight network. "
            "I read live dispatch data, predict late deliveries, cite company SOPs, "
            "and flag what needs a human's attention. I recommend and explain; "
            "you make the calls. What can I do for you?"
        )
    if intent == STATUS:
        return (
            "All systems green on my end — tracking every load in real time. "
            "What do you need?"
        )
    if intent == ACK:
        return "Got it — shout if you need anything else."
    return (
        "I'm here and listening. Ask me about loads, carriers, drivers, "
        "delays, or procedures."
    )
