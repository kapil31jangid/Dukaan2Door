# Survey Methodology

## Research objective

Collect genuine evidence about inventory practices, local delivery operations,
customer needs, and willingness to try Dukaan2Door. The survey validates a
problem and potential product fit; it does not establish profitability or prove
causation.

## Current collection status

**Not distributed and no responses collected.** The repository contains
ready-to-enter questionnaires and empty CSV templates only.

## Audiences

| Survey | Eligible participant | Suggested recruitment |
|---|---|---|
| Shopkeeper | Owner, manager, or staff member involved in stock at a local kirana/general store | In-person visit with permission, local retailer association, supervised academic outreach |
| Customer | Adult or institutionally permitted participant who purchases groceries/essentials | Campus/community outreach, neighborhood groups with administrator permission, in-person QR code |

Avoid presenting convenience samples as representative of an entire city or
market. Record recruitment channel and broad area so sampling limitations are
visible.

## Procedure

1. Obtain faculty/institutional approval where required.
2. Create two separate forms from the supplied questionnaires.
3. Keep consent (`S0`/`C0`) required and terminate the form when consent is
   declined.
4. Do not require names, phone numbers, email addresses, exact addresses, store
   revenue, account numbers, or government identifiers.
5. Pilot each form with 2–3 people for wording and completion time; exclude or
   label pilot responses if questions change afterward.
6. Keep each form open for a documented date range and log the recruitment
   channels used.
7. Export responses as CSV without adding fictional or duplicate records.
8. Store raw exports outside public Git history when they contain free text or
   contact information.

## Suggested sample plan

Set sample targets with faculty before distribution. Report achieved counts,
not targets, and do not claim statistical representativeness unless sampling
supports it. Seek variation in store size, current inventory method, customer
shopping channel, and broad area.

## Form configuration

- Use the question IDs (`S0`–`S13`, `C0`–`C12`) as short spreadsheet column
  names or include them at the beginning of each form question.
- Export multi-select choices separated by semicolons.
- Make only consent and core closed questions required.
- Do not enable automatic email collection.
- Keep one response per participant when the form platform supports it without
  forcing unnecessary identity collection.

## Data quality and exclusions

Document, never silently hide:

- Responses without consent
- Empty or substantially incomplete responses
- Exact duplicates
- Test/pilot submissions
- Responses outside the stated audience

Keep an exclusion count and reason in the findings. Do not alter genuine
answers to make results cleaner.

## Analysis

For each audience report:

- Total submitted, excluded, and analyzed responses
- Counts and percentages for every closed question
- Multi-select counts with denominator clearly stated
- Common stock/order problems
- Feature and workflow preferences
- Delivery-fee preferences
- Shopkeeper willingness to participate and customer willingness to use
- Free-text themes with short paraphrases; suppress details that could identify
  a participant

Percentages should show both numerator and denominator. Small convenience
samples should be described as directional evidence only.

## Repository tools

1. Copy the empty templates:
   `shopkeeper-responses-template.csv` and `customer-responses-template.csv`.
2. Add only genuine exported responses to private working copies.
3. Run:

```bash
python scripts/analyze_survey.py \
  --shopkeepers /path/to/shopkeeper-responses.csv \
  --customers /path/to/customer-responses.csv \
  --output docs/survey/survey-findings.md
```

The analyzer refuses files with headers only and will not create findings when
there are no genuine rows.

## Privacy and retention

Use aggregate reporting. Review free text before sharing. Keep raw response
files access-controlled, define a deletion date with faculty, and publish only
the minimum evidence needed for academic review.
