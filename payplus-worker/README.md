# חיבור PayPlus לאתר – הוראות הקמה

האתר יושב על GitHub Pages ואין לו שרת. PayPlus דורשת שיצירת דף התשלום תיעשה
בצד שרת עם המפתחות הסודיים, ולכן יש כאן Worker קטן של Cloudflare (חינמי)
שעושה רק דבר אחד: מקבל מהאתר את פרטי התרומה, מבקש מ-PayPlus קישור לדף תשלום
ומחזיר אותו. האתר פותח את הקישור בחלון בתוך הדף (iframe).

```
תורם ממלא טופס ← האתר שולח ל-Worker ← ה-Worker פונה ל-PayPlus (עם המפתחות)
                                    ← מחזיר קישור ← נפתח בחלון באתר
תשלום הצליח ← PayPlus מעבירה ל-success.html
```

## 1. מה צריך מ-PayPlus

בפאנל של PayPlus (או מנציג התמיכה):

- **API Key**
- **Secret Key**
- **Payment Page UID** – המזהה של דף התשלום שיוצג באתר

כדאי לבקש גם **פרטי סביבת בדיקות (Dev / Sandbox)** כדי לבדוק בלי חיוב אמיתי.

בהגדרות דף התשלום בפאנל כדאי לוודא:
- שהדף מורשה להיפתח ב-iframe בדומיין `www.tomcheitorah.com`
- הפקת קבלה אוטומטית (אם רוצים קבלות דרך PayPlus)

## 2. הקמת ה-Worker ב-Cloudflare (דרך האתר, בלי התקנות)

1. נכנסים ל-[dash.cloudflare.com](https://dash.cloudflare.com) ופותחים חשבון חינמי.
2. בתפריט: **Workers & Pages** ← **Create** ← **Create Worker**.
3. נותנים שם, למשל `tomchei-torah-payplus`, ולוחצים **Deploy**.
4. לוחצים **Edit code**, מוחקים את מה שיש, מדביקים את כל התוכן של
   `worker.js` מהתיקייה הזו, ולוחצים **Deploy**.
5. חוזרים ל-Worker ← **Settings** ← **Variables and Secrets** ומוסיפים:

| שם | סוג | ערך |
|---|---|---|
| `PAYPLUS_API_KEY` | **Secret** | ה-API Key |
| `PAYPLUS_SECRET_KEY` | **Secret** | ה-Secret Key |
| `PAYPLUS_PAGE_UID` | Text | מזהה דף התשלום |
| `PAYPLUS_ENV` | Text | `dev` לבדיקות, `prod` לחיוב אמיתי |
| `SITE_URL` | Text | `https://www.tomcheitorah.com` |
| `ALLOWED_ORIGINS` | Text | `https://www.tomcheitorah.com,https://tomcheitorah.com` |

6. מעתיקים את כתובת ה-Worker (נראית כמו
   `https://tomchei-torah-payplus.XXXX.workers.dev`).

## 3. חיבור האתר ל-Worker

ב-`donate.html` יש בתחילת הסקריפט שורה:

```js
var PAYPLUS_ENDPOINT = '';
```

מכניסים בין הגרשיים את כתובת ה-Worker. עד שהשורה הזו מוגדרת, לחיצה על
כפתור התרומה מציגה הודעה עם מספר הטלפון במקום לפתוח תשלום.

## 4. בדיקה ומעבר לאוויר

1. עם `PAYPLUS_ENV = dev` עושים תרומת ניסיון עם כרטיס בדיקה של PayPlus.
2. מוודאים שהחלון נפתח, שהתשלום עובר ושמגיעים לדף התודה עם הסכום.
3. מחליפים את `PAYPLUS_ENV` ל-`prod` (ואת המפתחות לאלה של סביבת הייצור
   אם הם שונים).

## מה נשלח ל-PayPlus

| בטופס | ב-PayPlus |
|---|---|
| סכום | `amount` |
| שם לקבלה / שם העסק | `customer.customer_name` |
| דוא״ל | `customer.email` |
| טלפון | `customer.phone` |
| ת.ז. / ח.פ. | `customer.vat_number` |
| הקדשה | `more_info` |
| יחיד / עסק | `more_info_2` |
| שם מלא של התורם | `more_info_3` |
