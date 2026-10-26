const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  WidthType,
  AlignmentType,
  ShadingType,
} = require('docx');

const primaryNavy = '0B1A30';
const secondaryNavy = '1E293B';
const goldPrimary = 'D4AF37';
const slateMuted = '64748B';
const bgLight = 'F8FAFC';
const borderLight = 'E2E8F0';

function createHeading1(text) {
  return new Paragraph({
    text: text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 140 },
    run: {
      color: primaryNavy,
      bold: true,
      size: 32, // 16pt
      font: 'Calibri',
    },
  });
}

function createHeading2(text) {
  return new Paragraph({
    text: text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 100 },
    run: {
      color: secondaryNavy,
      bold: true,
      size: 26, // 13pt
      font: 'Calibri',
    },
  });
}

function createHeading3(text) {
  return new Paragraph({
    text: text,
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 80 },
    run: {
      color: '334155',
      bold: true,
      size: 22, // 11pt
      font: 'Calibri',
    },
  });
}

function createParagraph(text, options = {}) {
  return new Paragraph({
    spacing: { after: 120, line: 276 },
    children: [
      new TextRun({
        text: text,
        size: 22, // 11pt
        font: 'Calibri',
        color: options.color || '1E293B',
        bold: options.bold || false,
        italics: options.italics || false,
      }),
    ],
  });
}

function createBullet(text, boldPrefix = '') {
  const children = [];
  if (boldPrefix) {
    children.push(
      new TextRun({
        text: boldPrefix + ' ',
        bold: true,
        size: 22,
        font: 'Calibri',
        color: '0F172A',
      })
    );
  }
  children.push(
    new TextRun({
      text: text,
      size: 22,
      font: 'Calibri',
      color: '334155',
    })
  );

  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 80, line: 260 },
    children: children,
  });
}

function createStepBullet(stepNum, stepTitle, stepDescription) {
  return new Paragraph({
    spacing: { after: 100, line: 260 },
    children: [
      new TextRun({
        text: `Step ${stepNum}: ${stepTitle} - `,
        bold: true,
        size: 22,
        font: 'Calibri',
        color: primaryNavy,
      }),
      new TextRun({
        text: stepDescription,
        size: 22,
        font: 'Calibri',
        color: '334155',
      }),
    ],
  });
}

function createTable(headers, rows) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(
      (h) =>
        new TableCell({
          shading: { type: ShadingType.CLEAR, fill: primaryNavy },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: h,
                  bold: true,
                  color: 'FFFFFF',
                  size: 20,
                  font: 'Calibri',
                }),
              ],
            }),
          ],
        })
    ),
  });

  const contentRows = rows.map((r, idx) => {
    const bgColor = idx % 2 === 0 ? 'FFFFFF' : bgLight;
    return new TableRow({
      children: r.map(
        (cellText) =>
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: bgColor },
            children: [
              new Paragraph({
                spacing: { before: 60, after: 60 },
                children: [
                  new TextRun({
                    text: cellText,
                    size: 20,
                    font: 'Calibri',
                    color: '1E293B',
                  }),
                ],
              }),
            ],
          })
      ),
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...contentRows],
  });
}

const doc = new Document({
  sections: [
    {
      properties: {
        page: {
          margin: {
            top: 1440, // 1 inch
            right: 1440,
            bottom: 1440,
            left: 1440,
          },
        },
      },
      children: [
        // Title block
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 80 },
          children: [
            new TextRun({
              text: 'JENISTA CHIT FUNDS',
              size: 44, // 22pt
              bold: true,
              color: primaryNavy,
              font: 'Calibri',
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [
            new TextRun({
              text: 'MOBILE APPLICATION - COMPLETE USER MANUAL & DOCUMENTATION',
              size: 26, // 13pt
              bold: true,
              color: goldPrimary,
              font: 'Calibri',
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 360 },
          children: [
            new TextRun({
              text: 'Android & iOS Native Experience | React Native Expo Edition | Version 1.0.8',
              size: 20,
              italics: true,
              color: slateMuted,
              font: 'Calibri',
            }),
          ],
        }),

        // 1. Executive Summary
        createHeading1('1. Executive Overview'),
        createParagraph(
          'The Jenista Chit Funds Mobile Application is a full-featured financial operations and member portal engineered for both staff field operations and subscriber self-service. The mobile app interfaces seamlessly with the centralized MongoDB backend and shares two-way synchronized data with the Web Administration Portal.'
        ),
        createParagraph(
          'The mobile application supports role-based access control, allowing three distinct personas to interact with tailored dashboards:'
        ),
        createBullet('Complete operational control, member registration, chit group formation, payment verifications, and general ledger supervision.', 'Admin Executive:'),
        createBullet('Field collection, installment receipt creation with instant PDF sharing, and assigned dues management.', 'Collection Executive / Staff:'),
        createBullet('Self-service dashboard, online UPI / QR due payment, payment receipt uploads, and monthly installment breakdown schedules.', 'Subscriber / Customer:'),

        // 2. Architecture & Tech Stack
        createHeading1('2. System Architecture & Features'),
        createTable(
          ['Component', 'Technology', 'Purpose / Feature'],
          [
            ['Core Engine', 'React Native 0.81 & Expo SDK 54', 'Cross-platform native mobile performance for iOS and Android'],
            ['Navigation', 'React Navigation (Drawer & Stack)', 'Native headers, sidebar drawer, seamless sub-screen stack navigation'],
            ['Local Storage', 'Expo SecureStore & LocalCache', 'Offline-first resilience and instant data access'],
            ['Receipts & PDF', 'expo-print & expo-sharing', 'Instant generation and WhatsApp/PDF sharing of official receipts'],
            ['Backend API', 'Node.js Express + MongoDB Atlas', 'Real-time REST endpoints and bidirectional synchronization'],
            ['Security', 'JWT & Secure Role Guards', 'Role-protected screens and encrypted credential storage']
          ]
        ),

        // 3. User Manual: Admin Role
        createHeading1('3. User Manual: Administrator Operations'),
        createParagraph(
          'Administrators have full visibility into company accounts, members, chits, and cash flow. The following sections walk through each administrative module.'
        ),

        createHeading2('3.1 Dashboard & Key Metrics'),
        createBullet('View Total Cumulative Chit Fund Value, Total Collections, and Total Pending Dues in real time.', 'Hero Financial Summary:'),
        createBullet('View breakdown of enrolled tickets across Fixed, Regular, and Auction chit schemes.', 'Scheme Distribution:'),
        createBullet('Access Add Member, Record Payments, and Advanced Reports with a single tap.', 'Quick Action Tiles:'),
        createBullet('Tapping the bell icon in the top right opens the Notifications & Alerts screen, displaying pending verification requests and overdue reminders.', 'Notifications Bell:'),

        createHeading2('3.2 Customer & Member Management'),
        createStepBullet('1', 'Register Member', 'Tap "Add Member" on the dashboard or open the sidebar and select "Add New Member". Enter Full Name, 10-digit Mobile Number, Aadhar, PAN, and initial scheme preferences. Tap "Submit" to save the member locally and sync with MongoDB.'),
        createStepBullet('2', 'Member Directory', 'Open the sidebar and tap "Members". Search any member by Name, Customer ID, or Mobile number. The list shows their active chit status and pending dues.'),
        createStepBullet('3', 'Member Profile & Details', 'Tapping any member opens their comprehensive profile containing their total paid amount, pending balance, enrolled chit cards, and direct buttons to "Issue Receipt" or "Deactivate Customer Account".'),

        createHeading2('3.3 Chit Groups & Plan Management'),
        createStepBullet('1', 'View All Groups', 'Open the sidebar and tap "Groups". View cards for each chit group including Total Chit Value, Duration, and Filled Capacity.'),
        createStepBullet('2', 'Group Enrolled Members', 'Tap any Chit Group card to open its detail view. The "Enrolled Members" tab displays ONLY members enrolled in that specific group, sorted by ticket number (#1, #2, etc.), complete with payment status tags (PAID / DUE).'),
        createStepBullet('3', 'Enroll Member to Group', 'Inside the group detail view, tap "Add Member". Enter the customer mobile number or name to verify them, select the scheme, confirm the monthly installment, and tap "Enroll Member". The filled member counter updates automatically across the app.'),

        createHeading2('3.4 Receipt Desk & Collections'),
        createStepBullet('1', 'Open Receipt Desk', 'Tap "Record Payments" on the dashboard or select "Receipt Desk & Collections" from any customer profile.'),
        createStepBullet('2', 'Select Member', 'Tap the "Member" field. An interactive modal opens with real-time search. Select the desired customer to automatically populate their name, mobile, and pending installment.'),
        createStepBullet('3', 'Select Chit Group', 'Tap the top Chit Group card to pick or switch the target chit group.'),
        createStepBullet('4', 'Payment Method', 'Choose between UPI, Cash, or Bank Transfer. For UPI and Bank Transfer, enter the optional UTR/Reference number. For Cash, no reference number is required.'),
        createStepBullet('5', 'Save & Share', 'Tap "Save Payment". The payment is credited directly into the General Ledger, the member balance is deducted, and a dialog gives you the option to Print or Share an official PDF receipt via WhatsApp or Email.'),

        createHeading2('3.5 General Ledger & Accounting'),
        createBullet('Open the sidebar and select "Payments" / "General Ledger".', 'Navigation:'),
        createBullet('Every transaction clearly displays the real Customer Name (e.g. Pooja, Rajesh) and Group Name (e.g. Diamond Series A) instead of raw codes or IDs.', 'Accurate Member Data:'),
        createBullet('Filter transactions by All, Completed, Pending, or Failed.', 'Status Filters:'),
        createBullet('Displays total collections, date/time timestamps, collected by executive name, and payment mode.', 'Financial Audit:'),

        createHeading2('3.6 Payment Verifications (Online UPI Submissions)'),
        createBullet('When a customer uses the "Pay Now" option in their mobile app and uploads a payment screenshot, the request appears under "Payment Verifications".', 'Workflow:'),
        createBullet('Administrators can tap "View Proof" to inspect the uploaded payment screenshot and UTR number.', 'Proof Inspection:'),
        createBullet('Tapping "Approve & Credit Ledger" marks the payment approved, reduces the customer pending balance, and credits the General Ledger immediately.', 'One-Tap Approval:'),

        // 4. User Manual: Staff & Field Executive Role
        createHeading1('4. User Manual: Field Collection Executive'),
        createParagraph(
          'Staff executives log in using their registered mobile number and password to access an optimized field-collection interface.'
        ),
        createBullet('Displays Today\'s Collections and Assigned Overdue Balances.', 'Field Hero Card:'),
        createBullet('Lists all members with overdue installments. Staff can tap "Call Member", "WhatsApp", or "Collect".', 'Assigned Dues Tab:'),
        createBullet('Lists all collection vouchers and receipts issued during the day for end-of-day cash reconciliation.', 'Recorded Receipts Tab:'),
        createBullet('Tapping "Collect" on any member opens the Receipt Desk with that member\'s details and dues pre-filled for rapid collection.', 'Instant Receipting:'),

        // 5. User Manual: Customer / Subscriber Role
        createHeading1('5. User Manual: Customer / Subscriber Experience'),
        createParagraph(
          'Subscribers have complete transparency into their chit funds without needing to visit the branch.'
        ),
        createBullet('View active chit plans, ticket numbers, total paid, and next payment due date.', 'Account Overview:'),
        createBullet('Tap "Pay Now" on any due card to view company bank and UPI QR details. Enter the UTR number, upload a payment screenshot from phone gallery or camera, and submit for verification.', 'Pay Now & Upload Proof:'),
        createBullet('Tap "Installment Breakdown" to see month-by-month status (Month 1, Month 2, etc.) with exact dividend earned and net amount due.', 'Installment Schedule:'),
        createBullet('View historical transaction receipts and download official receipts on demand.', 'Payment History:'),

        // 6. Troubleshooting & FAQs
        createHeading1('6. Troubleshooting & Frequently Asked Questions'),
        createTable(
          ['Issue / Question', 'Solution / Behavior'],
          [
            ['Notification bell opens wrong tab', 'Fixed in v1.0.8: The bell icon now opens the dedicated Notifications & Alerts screen.'],
            ['Ledger shows random numbers instead of names', 'Fixed in v1.0.8: Ledger extracts and displays real customer name and chit group.'],
            ['Cannot select member in Receipt Desk', 'Fixed in v1.0.8: Tapping the Member box opens an interactive search picker with group filtering.'],
            ['Members from other groups showing in group detail', 'Fixed in v1.0.8: Strict group matching ensures only members of that exact group appear.'],
            ['Offline data synchronization', 'All records created offline are stored in SecureStore and synced when connectivity is restored.']
          ]
        ),

        // 7. Support & Maintenance
        createHeading1('7. Technical Support & System Administration'),
        createParagraph(
          'For technical support, database backup configurations, or custom scheme modifications, contact the Jenista IT administrative desk:'
        ),
        createBullet('support@jenistachits.com', 'Support Email:'),
        createBullet('Jenista Chit Funds Private Limited, Head Office', 'Branch Location:'),
        createBullet('Antigravity Automated Deployment System', 'Version & Build:')
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  const outputPath = path.join('d:', 'Chits', 'Jenista_Mobile_App_User_Manual.docx');
  fs.writeFileSync(outputPath, buffer);
  console.log('Successfully created Word document at:', outputPath);
});
