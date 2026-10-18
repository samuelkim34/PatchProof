# PatchProof training target — deliberately vulnerable

**For a repository you own only. Do not deploy this Python code.**

This small intentionally vulnerable SQLite login function is included so you can create a separate disposable public GitHub repository and test PatchProof's *repository URL* workflow. The scanner is not hardcoded to its URL or filenames; this sample is merely a reproducible first test.

To verify the normal (not security) test locally in this sample folder:

```bash
python3 -m unittest discover -s tests -v
```

The login code deliberately uses unsafe string interpolation to create a SQL query. It exists for defensive testing and education, not production.
