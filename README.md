# Food Diary · 食記

A private, photo-first food diary that runs as a single web page (`index.html`): no build step, no server, no database of its own.

- **Calendar:** a month of food photos, with a calorie-vs-target bar on each day.
- **Day:** meals grouped by breakfast, lunch, dinner, snack and drink, with photos, portions, macros, tags and notes, and day totals against your targets.
- **Week:** calories and protein per day against target, weekly averages, and a strip of the week's photos.
- **Month:** a monthly recap (meals logged, home-cooked vs eating out, top cuisines and tags, best protein day, days on target), daily calorie chart, weight trend and a photo archive.
- **Editing:** add entries (with a photo from the camera or library), edit any field, swap a photo, or delete an entry. Deleting only marks the row as deleted.
- **Demo mode:** open `index.html?demo=1`, or tap "Try the demo", to look around with made-up sample data.

## Where the data lives

All data stays in **your own Google account**:

- a Google Sheet whose name contains `Food & Weight Log`, with the tabs `Food log`, `Targets` and `Weight`
- photos in a Drive folder called `Food Diary Photos`

After you sign in, the page finds the sheet by name, or asks you to paste its URL. It stores the sheet ID and folder ID only in your browser's `localStorage`. This repository holds code only: no sheet IDs, personal data, API keys or tokens. The only setting in the code is `GOOGLE_CLIENT_ID`, which is a public OAuth client ID and not a secret.

The page talks straight to the Google Sheets v4 and Drive v3 APIs from your browser, using a short-lived access token from Google Identity Services. Photos you've viewed are cached in IndexedDB on your device so they load fast and also work offline.

## Food log format

The page maps columns **by header name**, so column order doesn't matter and extra columns are kept untouched:

```
entry_id | date | time | meal_type | item | portion | kcal | protein_g | carbs_g | fat_g | fibre_g | sugar_g | sodium_mg | alcohol_units | source | cuisine | location | tags | notes | photo_file_id | photo_name | updated_at | updated_by | deleted
```

- `date` is `YYYY-MM-DD`, `time` is `HH:MM`, and `updated_at` is `YYYY-MM-DD HH:MM` in UK time (Europe/London).
- `meal_type` is one of breakfast, lunch, dinner, snack or drink. `source` is home-cooked, eating out or takeaway.
- Photos are named `YYYY-MM-DD_HHMM_<meal>_<n>.jpg`. `entry_id` is the photo name without `.jpg`, plus `_<item number>`. Several items can share one photo.
- Entries added in the app **without** a photo get `YYYY-MM-DD_HHMM_<meal>_k<n>_<item>`. The `k` stops them clashing with photo-based IDs.
- `entry_id` never changes, even when you edit the date, meal or photo.
- Deleting sets `deleted` to `TRUE`. Deleted rows are hidden and left out of all totals.
- Every edit made in the app sets `updated_at`, and sets `updated_by` to your editor name. That's your Google first name in lower case, and you can change it in the ⋯ menu.
- Before every edit, the app re-reads the sheet and finds the row by `entry_id`, never by a remembered row number. It then writes back only the fields you changed, so edits made elsewhere in the meantime are kept.

If the sheet is missing any of the columns the app needs, the page still shows your data but stays read-only.

## Setup

See [SETUP.md](SETUP.md).

## Tests

```
node --test tests/*.test.mjs
```
