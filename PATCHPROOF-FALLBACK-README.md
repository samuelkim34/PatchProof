PatchProof Gemini fallback fix

This update ONLY replaces scripts/run-proof.mjs. It keeps your .env and other files intact.

Fish shell install (extract in existing project directory):

    cd ~/Projects/patchproof
    python3 -m zipfile -e ~/Downloads/patchproof-fallback-fix.zip .
    node --env-file=.env scripts/run-proof.mjs

On HTTP 503 from the primary Gemini model, PatchProof automatically tries gemini-3.5-flash-lite. It does not retry on quota/authentication errors. Reports include the model actually used.
