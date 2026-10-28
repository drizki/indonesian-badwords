# Report a gap or improve the dictionary

[Documentation](README.md)

A useful report makes the behavior reproducible and explains the intended policy.
Use the [dictionary report form](https://github.com/drizki/indonesian-badwords/issues/new?template=dictionary-report.yml)
for missed profanity, false positives, and evidence corrections. Explicit terms
are welcome when needed to demonstrate the problem.

Include the installed version, original or anonymized text, expected and actual
results, constructor options, custom dictionary changes, and per-call exceptions.
Keep a nearby benign example: it helps distinguish an improvement from a rule
that simply matches more text. Do not paste private conversations or identifying
information.

## Propose a dictionary entry

Supply a source that shows coarse or abusive use of the exact spelling, or
explain that the proposed form is a derived alias. A citation for an ordinary
literal meaning does not prove insulting usage. Note the language, variety, or
region of the cited usage without claiming exclusive origin.

If a term has a common literal meaning, explain when it should be allowed and
why it belongs in a conservative or opt-in profile. Editorial severity describes
register intensity; it is not a message toxicity score. Keep unresolved evidence
explicit rather than guessing a category, region, or severity.

Link to sources and quote only the short passage needed to support the claim.
Include licensing or reuse information where known; do not copy another
project's dictionary or private content without suitable rights.

## Contribute code or docs

Follow [development and dictionary maintenance](maintaining.md). Add meaningful
abusive and benign regression cases for behavior changes. Keep both READMEs in
sync; technical docs remain English. Runnable examples and executable Markdown
checks are part of CI, so update them when changing a documented contract.
