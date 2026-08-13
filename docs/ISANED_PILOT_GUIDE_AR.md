# تشغيل Live i18n مع Isaned Revamp

هذا المستند يفصل بين ثلاثة أشياء مختلفة حتى لا تختلط دورة العمل:

1. **Isaned Revamp**: تطبيق Angular الحقيقي الموجود في Azure DevOps Repos.
2. **Live i18n Tool**: الحزم المفتوحة المصدر الموجودة في هذا المستودع، والمسؤولة عن اكتشاف النص داخل Angular وعرض المحرر الحي والعقود المشتركة.
3. **Live i18n Cloud**: مستودع خاص جديد يحتوي على Studio وAPI وقاعدة البيانات والمراجعة والتصدير. هذا الجزء لم يُبنَ بعد.

## ما يعمل الآن

- محرر Angular يعمل محليًا مع `ng serve` أو Nx ويعدل مفاتيح JSON الموجودة فقط.
- حماية الكتابة المحلية بالـorigin والـsession nonce وفحص التعارضات.
- عقود Change Sets وQA والمراجعة والـexport محايدة تمامًا عن GitHub وAzure DevOps.
- نقطة دخول منفصلة للـprotected staging هي `@live-i18n/client/staging`.
- Demo متكامل داخل `apps/pilot-demo` يحاكي Editor ثم Reviewer ثم Developer Export داخل المتصفح.

ما لا يعمل كخدمة حقيقية حتى الآن هو تسجيل الدخول، حفظ Change Sets في قاعدة بيانات، إرسالها لمراجع آخر، وتشغيل Download من Cloud. الـDemo يحاكي هذه الأجزاء داخل الذاكرة فقط.

## دورة الـPilot الحقيقية

```text
Developer setup مرة واحدة
  -> Pipeline يبني Test Environment ويرفع Catalog Snapshot إلى Live i18n Cloud
  -> Content Editor يسجل الدخول إلى Studio
  -> Studio ينشئ Edit Session مقيدة بالـorigin ويفتح Test Environment
  -> Editor يضغط على نص موجود ويعدله في مكانه
  -> Save يرسل Change Entry إلى Cloud ولا يكتب في Azure Repo
  -> AI يقترح، والإنسان يضغط Apply صراحة
  -> QA حتمي يفحص placeholders وHTML وICU والطول واللغات المطلوبة
  -> Editor يرسل Change Set للمراجعة
  -> Reviewer مختلف يوافق أو يطلب تعديلات
  -> بعد الموافقة ينزل Developer manifest وJSON patch أو ملفات JSON محدثة
  -> Developer يطبقها محليًا ويراجع git diff
  -> Developer يعمل commit وpush وPull Request بالطريقة المعتادة في Azure DevOps
```

لا يوجد في هذه الدورة GitHub App أو Azure DevOps API أو كتابة تلقائية في المستودع.

## الإعداد المطلوب داخل Isaned Revamp

المسار المذكور `D:\projects\Isaned Rvamp` غير متاح في بيئة العمل الحالية، لذلك هذه الخطوات لم تُطبق عليه بعد.

### 1. تثبيت الحزم

بعد نشر نسخ الـPilot في npm أو private registry:

```powershell
npm install @live-i18n/client @live-i18n/protocol
```

حزمة `@live-i18n/plugin` مطلوبة للتطوير المحلي فقط، وليست مطلوبة في Test Environment المتصل بالـCloud:

```powershell
npm install --save-dev @live-i18n/plugin
```

### 2. تعريف الملفات المسموح تعديلها

ينشأ `live-i18n.config.json` في جذر Isaned:

```json
{
  "schemaVersion": 1,
  "projectId": "isaned-revamp",
  "environmentId": "test",
  "sourceLocale": "en",
  "requiredLocales": ["ar"],
  "keyMode": "nested",
  "files": {
    "en": ["src/assets/i18n/en.json"],
    "ar": ["src/assets/i18n/ar.json"]
  }
}
```

المسارات الفعلية يجب ضبطها بعد فحص مشروع Isaned. الـPilot لا يسمح بإضافة أو حذف أو إعادة تسمية keys.

### 3. إضافة Staging Provider

في ملف providers خاص بالـTest فقط:

```ts
import { inject } from '@angular/core';
import {
  TranslocoDirective,
  TranslocoPipe,
  TranslocoService,
} from '@jsverse/transloco';
import { provideStagingLiveTranslations } from '@live-i18n/client/staging';
import { withTransloco } from '@live-i18n/client';

export const LIVE_I18N_STAGING_PROVIDERS = [
  provideStagingLiveTranslations(
    () =>
      withTransloco(
        inject(TranslocoService),
        TranslocoPipe,
        TranslocoDirective,
      ),
    {
      apiBaseUrl: 'https://live-i18n-api.internal',
      projectId: 'isaned-revamp',
      environmentId: 'test',
      catalogSnapshotId: 'provided-at-deploy-time',
      getSessionToken: () => sessionStorage.getItem('live-i18n-session'),
    },
  ),
];
```

شكل الـadapter يتغير إذا كان Isaned يستخدم `ngx-translate` بدل Transloco. يجب فحص المشروع أولًا.

### 4. منع المحرر من دخول Production

يكون هناك ملفان:

- `live-i18n.providers.ts` للـTest، ويستورد `@live-i18n/client/staging`.
- `live-i18n.providers.production.ts` للـProduction، ويصدر array فارغة ولا يستورد أي كود authoring.

ويستخدم Angular `fileReplacements` لاستبداله في production build. يجب إضافة اختبار CI يبحث داخل production bundle ويتأكد أن علامات Live i18n غير موجودة.

### 5. رفع Catalog Snapshot بدون Azure DevOps integration

في أول Pilot يوجد اختياران صغيران:

- Developer يرفع ZIP يحتوي فقط على ملفات الترجمة المسموح بها من شاشة Admin.
- أو خطوة مستقلة في Azure Pipeline تشغل catalog uploader باستخدام Project service token. هذه ليست Azure DevOps API integration؛ هي مجرد HTTP upload من عملية الـbuild.

الـsnapshot يحفظ raw bytes وencoding وLF/CRLF وBOM وtrailing newline وbase commit. هذا ما يسمح بإخراج ملفات محدثة بلا formatting churn.

## مستودع Live i18n Cloud الخاص

الاقتراح أن يكون مستودعًا منفصلًا وخاصًا، مثل:

```text
live-i18n-cloud/
  apps/
    studio/          # Login, organizations, projects, Change Sets, review, export
    api/             # REST API, authorization, QA authority, audit events
  packages/
    domain/          # Cloud business rules; imports @live-i18n/protocol
    database/        # PostgreSQL schema and migrations
    auth/            # Identity and origin-bound edit sessions
    catalog/         # Snapshot upload and parsing
    ai/              # Provider adapter; optional for first Pilot
    export/          # Manifest, patch and formatting-preserving JSON artifacts
  deploy/
    docker/
    azure-pipelines/
```

المستودع الخاص يعتمد على `@live-i18n/protocol` المنشور من المستودع المفتوح. لا ينسخ domain models ولا يضع GitHub أو Azure DevOps داخل Change Set logic.

## أقل Cloud MVP مطلوب

1. تسجيل دخول داخلي.
2. Organization واحدة وProject واحد في البداية، مع Admin وEditor وReviewer.
3. Catalog upload يدوي.
4. origin-bound edit sessions قصيرة العمر.
5. Change Set وChange Entries في PostgreSQL.
6. optimistic concurrency باستخدام revision وoriginal value hashes.
7. QA الحتمي على API قبل submit.
8. review separation وapprove/request changes.
9. audit events.
10. تنزيل manifest وJSON patch/updated files بعد approval فقط.

AI يمكن إضافته بعد نجاح Edit -> QA -> Review -> Export، ولا يمنع بدء الـPilot.

## ما يفعله كل شخص

### Developer قبل الـPilot

- يثبت الحزم ويضبط adapter وallowlist وproduction replacement.
- يرفع أول catalog snapshot وينشر Test Environment.
- ينشئ المستخدمين أو يربط الدخول الداخلي.

### Content Editor يوميًا

- يدخل Studio ولا يحتاج Azure DevOps access.
- يفتح Test Environment من زر Launch editor.
- يضغط النص ويكتب أو يستخدم AI ثم Apply.
- يصلح QA blockers ويرسل Change Set.

### Reviewer

- يرى before/after والسياق والـQA.
- لا يستطيع مراجعة Change Set أنشأه بنفسه.
- يوافق أو يطلب تعديلات مع تعليق.

### Developer بعد الموافقة فقط

```powershell
# Apply manifest/patch or replace the exported allowlisted JSON files
git diff
git add src/assets/i18n/en.json src/assets/i18n/ar.json
git commit -m "content: apply Live i18n CS-1042"
git push
```

ثم ينشئ Pull Request في Azure DevOps كالمعتاد.

## تشغيل الـDemo الحالي

من جذر هذا المستودع:

```powershell
npm install
npm run demo:pilot
```

ثم افتح `http://localhost:4400` واتبع:

1. Content editor: اضغط Apply للاقتراح الإنجليزي.
2. لاحظ أن QA يمنع submit لأن العربية أصبحت outdated.
3. اضغط Apply للاقتراح العربي.
4. اضغط Submit for review.
5. Reviewer: اضغط Approve Change Set.
6. Developer: راجع manifest واضغط Download JSON artifact.

هذا الـDemo لا يكتب أي ملفات ولا يستخدم Cloud أو Azure DevOps؛ الغرض منه تثبيت تجربة المنتج قبل بناء البنية السحابية.
