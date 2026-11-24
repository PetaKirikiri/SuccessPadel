begin;
create table public.booking_demo_samples (
  id integer primary key check (id = 1),
  dataset jsonb not null check (jsonb_typeof(dataset) = 'object')
);
alter table public.booking_demo_samples enable row level security;
revoke all on public.booking_demo_samples from public, anon, authenticated;
grant select on public.booking_demo_samples to authenticated;
create policy "Verified owners read booking demo samples" on public.booking_demo_samples
  for select to authenticated using (
    ((select auth.jwt()->>'aal') = 'aal2' or (select booking_private.has_google_session()))
    and exists (select 1 from public.booking_staff_access where role = 'owner')
  );
insert into public.booking_demo_samples (id, dataset) values (1, $demo$
{
  "date": "2026-11-25",
  "bookings": [
    {
      "date": "2026-11-22",
      "court": "Court 1",
      "time": "09:00",
      "duration": 90,
      "customer": "Mali & Anan",
      "coach": null,
      "activity": "play",
      "product": null,
      "preview": true
    },
    {
      "date": "2026-11-22",
      "court": "Court 2",
      "time": "10:00",
      "duration": 60,
      "customer": "Narin & Pim",
      "coach": null,
      "activity": "play",
      "product": null,
      "preview": true
    },
    {
      "date": "2026-11-22",
      "court": "Court 3",
      "time": "10:00",
      "duration": 60,
      "customer": "May",
      "coach": "David",
      "activity": "coaching",
      "product": "normal-coaching",
      "preview": true
    },
    {
      "date": "2026-11-22",
      "court": "Court 4",
      "time": "11:30",
      "duration": 90,
      "customer": "Ben & Lek",
      "coach": null,
      "activity": "play",
      "product": null,
      "preview": true
    },
    {
      "date": "2026-11-22",
      "court": "Court 2",
      "time": "14:00",
      "duration": 90,
      "customer": "Nok & Sam",
      "coach": null,
      "activity": "play",
      "product": null,
      "preview": true
    },
    {
      "coach": "David",
      "customer": "Maya",
      "court": "Court 1",
      "date": "2026-11-23",
      "time": "09:00",
      "duration": 60,
      "activity": "coaching",
      "product": "normal-coaching",
      "preview": true
    },
    {
      "coach": "Bia",
      "customer": "Alex",
      "court": "Court 2",
      "date": "2026-11-23",
      "time": "10:00",
      "duration": 60,
      "activity": "coaching",
      "product": "normal-coaching",
      "preview": true
    },
    {
      "coach": "Tong",
      "customer": "Kim",
      "court": "Court 3",
      "date": "2026-11-23",
      "time": "11:00",
      "duration": 60,
      "activity": "coaching",
      "product": "normal-coaching",
      "preview": true
    },
    {
      "coach": "Neung",
      "customer": "Mali K.",
      "court": "Court 4",
      "date": "2026-11-23",
      "time": "14:00",
      "duration": 60,
      "activity": "coaching",
      "product": "normal-coaching",
      "preview": true
    },
    {
      "coach": "David",
      "customer": "Anan S.",
      "court": "Court 1",
      "date": "2026-11-23",
      "time": "15:00",
      "duration": 60,
      "activity": "coaching",
      "product": "normal-coaching",
      "preview": true
    },
    {
      "date": "2026-11-25",
      "time": "15:00",
      "court": "Court 3",
      "coach": "Bia",
      "customer": "Mali K.",
      "players": [
        "Anan S.",
        "Narin T."
      ],
      "duration": 90,
      "price": 2400,
      "paid": false,
      "preview": true,
      "activity": "coaching",
      "product": "coaching-match"
    },
    {
      "date": "2026-11-27",
      "time": "14:00",
      "court": "Court 4",
      "coach": "Tong",
      "customer": "Alex Morgan",
      "players": [
        "Mali K.",
        "Anan S."
      ],
      "duration": 90,
      "price": 2400,
      "paid": false,
      "preview": true,
      "activity": "coaching",
      "product": "coaching-match"
    },
    {
      "activity": "play",
      "product": null,
      "court": "Court 1",
      "time": "08:00",
      "duration": 90,
      "customer": "Mali K.",
      "players": [
        "Narin T.",
        "Alex Morgan"
      ],
      "membership": "Member",
      "price": 600,
      "paid": true,
      "paymentMethod": "test-qr",
      "date": "2026-11-25",
      "preview": true,
      "paidAt": "2026-11-25T08:00:00+07:00",
      "paidBy": "Mali K.",
      "paidAmount": 600
    },
    {
      "activity": "coaching",
      "product": "normal-coaching",
      "court": "Court 3",
      "time": "09:00",
      "duration": 60,
      "customer": "Anan S.",
      "coach": "David",
      "price": 2000,
      "paid": false,
      "date": "2026-11-25",
      "preview": true
    },
    {
      "activity": "play",
      "product": null,
      "court": "Court 2",
      "time": "10:00",
      "duration": 90,
      "customer": "Ben",
      "players": [
        "Lek",
        "Pim",
        "Sam"
      ],
      "membership": "Non-member",
      "price": 1200,
      "paid": false,
      "date": "2026-11-25",
      "preview": true
    },
    {
      "activity": "coaching",
      "product": "coaching-match",
      "court": "Court 4",
      "time": "10:30",
      "duration": 90,
      "customer": "Narin T.",
      "players": [
        "Mali K.",
        "Alex Morgan"
      ],
      "coach": "Tong",
      "price": 2400,
      "paid": true,
      "paymentMethod": "test-card",
      "date": "2026-11-25",
      "preview": true,
      "paidAt": "2026-11-25T10:30:00+07:00",
      "paidBy": "Narin T.",
      "paidAmount": 2400
    },
    {
      "activity": "play",
      "product": null,
      "court": "Court 1",
      "time": "12:00",
      "duration": 60,
      "customer": "Pim",
      "players": [
        "Anan S."
      ],
      "membership": "Non-member",
      "price": 800,
      "paid": false,
      "date": "2026-11-25",
      "preview": true
    },
    {
      "activity": "coaching",
      "product": "normal-coaching",
      "court": "Court 3",
      "time": "13:00",
      "duration": 60,
      "customer": "Alex Morgan",
      "coach": "Neung",
      "price": 2000,
      "paid": true,
      "paymentMethod": "test-qr",
      "date": "2026-11-25",
      "preview": true,
      "paidAt": "2026-11-25T13:00:00+07:00",
      "paidBy": "Alex Morgan",
      "paidAmount": 2000
    },
    {
      "activity": "play",
      "product": null,
      "court": "Court 2",
      "time": "16:30",
      "duration": 90,
      "customer": "Narin T.",
      "players": [
        "Anan S.",
        "Mali K.",
        "Alex Morgan"
      ],
      "membership": "Non-member",
      "price": 1200,
      "paid": false,
      "splitPayments": [
        {
          "payer": "Narin T.",
          "slot": 0,
          "amount": 300,
          "method": "QR code",
          "receivedAt": "2026-11-25T08:00:00Z"
        }
      ],
      "date": "2026-11-25",
      "preview": true
    },
    {
      "activity": "play",
      "product": null,
      "court": "Court 1",
      "time": "20:00",
      "duration": 60,
      "customer": "Alex Morgan",
      "players": [
        "Mali K.",
        "Narin T."
      ],
      "membership": "Member",
      "price": 400,
      "paid": true,
      "paymentMethod": "test-card",
      "date": "2026-11-25",
      "preview": true,
      "paidAt": "2026-11-25T20:00:00+07:00",
      "paidBy": "Alex Morgan",
      "paidAmount": 400
    },
    {
      "date": "2026-11-25",
      "weeklyOngoing": true,
      "eventId": "preview-competition-2026-11-25",
      "eventType": "competition",
      "eventRepeat": "weekly",
      "eventEnd": "20:00",
      "activity": "event",
      "customer": "Beginner Tournament · Mixed",
      "court": "Court 1",
      "time": "18:00",
      "duration": 120,
      "price": 0,
      "preview": true
    },
    {
      "date": "2026-11-25",
      "weeklyOngoing": true,
      "eventId": "preview-competition-2026-11-25",
      "eventType": "competition",
      "eventRepeat": "weekly",
      "eventEnd": "20:00",
      "activity": "event",
      "customer": "Beginner Tournament · Mixed",
      "court": "Court 2",
      "time": "18:00",
      "duration": 120,
      "price": 0,
      "preview": true
    },
    {
      "date": "2026-11-25",
      "weeklyOngoing": true,
      "eventId": "preview-competition-2026-11-25",
      "eventType": "competition",
      "eventRepeat": "weekly",
      "eventEnd": "20:00",
      "activity": "event",
      "customer": "Beginner Tournament · Mixed",
      "court": "Court 3",
      "time": "18:00",
      "duration": 120,
      "price": 0,
      "preview": true
    },
    {
      "date": "2026-11-25",
      "weeklyOngoing": true,
      "eventId": "preview-competition-2026-11-25",
      "eventType": "competition",
      "eventRepeat": "weekly",
      "eventEnd": "20:00",
      "activity": "event",
      "customer": "Beginner Tournament · Mixed",
      "court": "Court 4",
      "time": "18:00",
      "duration": 120,
      "price": 0,
      "preview": true
    },
    {
      "date": "2026-11-26",
      "weeklyOngoing": true,
      "eventId": "preview-competition-2026-11-26",
      "eventType": "competition",
      "eventRepeat": "weekly",
      "eventEnd": "20:00",
      "activity": "event",
      "customer": "Intermediate Competition · Mixed",
      "court": "Court 1",
      "time": "18:00",
      "duration": 120,
      "price": 0,
      "preview": true
    },
    {
      "date": "2026-11-26",
      "weeklyOngoing": true,
      "eventId": "preview-competition-2026-11-26",
      "eventType": "competition",
      "eventRepeat": "weekly",
      "eventEnd": "20:00",
      "activity": "event",
      "customer": "Intermediate Competition · Mixed",
      "court": "Court 2",
      "time": "18:00",
      "duration": 120,
      "price": 0,
      "preview": true
    },
    {
      "date": "2026-11-26",
      "weeklyOngoing": true,
      "eventId": "preview-competition-2026-11-26",
      "eventType": "competition",
      "eventRepeat": "weekly",
      "eventEnd": "20:00",
      "activity": "event",
      "customer": "Intermediate Competition · Mixed",
      "court": "Court 3",
      "time": "18:00",
      "duration": 120,
      "price": 0,
      "preview": true
    },
    {
      "date": "2026-11-26",
      "weeklyOngoing": true,
      "eventId": "preview-competition-2026-11-26",
      "eventType": "competition",
      "eventRepeat": "weekly",
      "eventEnd": "20:00",
      "activity": "event",
      "customer": "Intermediate Competition · Mixed",
      "court": "Court 4",
      "time": "18:00",
      "duration": 120,
      "price": 0,
      "preview": true
    },
    {
      "date": "2026-11-27",
      "weeklyOngoing": true,
      "eventId": "preview-competition-2026-11-27",
      "eventType": "competition",
      "eventRepeat": "weekly",
      "eventEnd": "20:00",
      "activity": "event",
      "customer": "Intermediate Competition · Fixed",
      "court": "Court 1",
      "time": "18:00",
      "duration": 120,
      "price": 0,
      "preview": true
    },
    {
      "date": "2026-11-27",
      "weeklyOngoing": true,
      "eventId": "preview-competition-2026-11-27",
      "eventType": "competition",
      "eventRepeat": "weekly",
      "eventEnd": "20:00",
      "activity": "event",
      "customer": "Intermediate Competition · Fixed",
      "court": "Court 2",
      "time": "18:00",
      "duration": 120,
      "price": 0,
      "preview": true
    },
    {
      "date": "2026-11-27",
      "weeklyOngoing": true,
      "eventId": "preview-competition-2026-11-27",
      "eventType": "competition",
      "eventRepeat": "weekly",
      "eventEnd": "20:00",
      "activity": "event",
      "customer": "Intermediate Competition · Fixed",
      "court": "Court 3",
      "time": "18:00",
      "duration": 120,
      "price": 0,
      "preview": true
    },
    {
      "date": "2026-11-27",
      "weeklyOngoing": true,
      "eventId": "preview-competition-2026-11-27",
      "eventType": "competition",
      "eventRepeat": "weekly",
      "eventEnd": "20:00",
      "activity": "event",
      "customer": "Intermediate Competition · Fixed",
      "court": "Court 4",
      "time": "18:00",
      "duration": 120,
      "price": 0,
      "preview": true
    },
    {
      "date": "2026-11-26",
      "court": "Court 1",
      "time": "08:30",
      "duration": 90,
      "customer": "Ben",
      "coach": null,
      "product": null,
      "paid": true,
      "price": 1200,
      "paidAmount": 1200,
      "paymentMethod": "test-qr",
      "paidBy": "Ben",
      "paidAt": "2026-11-26T08:30:00+07:00",
      "activity": "play",
      "membership": "Non-member",
      "preview": true
    },
    {
      "date": "2026-11-26",
      "court": "Court 3",
      "time": "10:30",
      "duration": 60,
      "customer": "Maya",
      "coach": "David",
      "product": "normal-coaching",
      "paid": true,
      "price": 2000,
      "paidAmount": 2000,
      "paymentMethod": "test-card",
      "paidBy": "Maya",
      "paidAt": "2026-11-26T10:30:00+07:00",
      "activity": "coaching",
      "membership": "Non-member",
      "preview": true
    },
    {
      "date": "2026-11-26",
      "court": "Court 4",
      "time": "15:00",
      "duration": 90,
      "customer": "Pim",
      "coach": "Bia",
      "product": "coaching-match",
      "paid": false,
      "price": 2400,
      "activity": "coaching",
      "membership": "Non-member",
      "preview": true
    },
    {
      "date": "2026-11-27",
      "court": "Court 2",
      "time": "09:00",
      "duration": 60,
      "customer": "Lek",
      "coach": null,
      "product": null,
      "paid": false,
      "price": 800,
      "activity": "play",
      "membership": "Non-member",
      "preview": true
    },
    {
      "date": "2026-11-27",
      "court": "Court 3",
      "time": "11:00",
      "duration": 60,
      "customer": "Narin T.",
      "coach": "Tong",
      "product": "normal-coaching",
      "paid": true,
      "price": 2000,
      "paidAmount": 2000,
      "paymentMethod": "test-card",
      "paidBy": "Narin T.",
      "paidAt": "2026-11-27T11:00:00+07:00",
      "activity": "coaching",
      "membership": "Non-member",
      "preview": true
    },
    {
      "eventId": "preview-beginner-clinic",
      "eventRepeat": "weekly",
      "weeklyOngoing": true,
      "date": "2026-11-28",
      "time": "14:00",
      "duration": 60,
      "eventEnd": "15:00",
      "court": "Court 4",
      "customer": "Padel Clinic · Beginners · Bia · 3 players",
      "eventCoach": "Bia",
      "activity": "event",
      "preview": true
    }
  ],
  "availability": [
    {
      "date": "2026-11-22",
      "coach": "Bia",
      "time": "10:00",
      "duration": 60,
      "preview": true
    },
    {
      "date": "2026-11-22",
      "coach": "David",
      "time": "11:00",
      "duration": 60,
      "preview": true
    },
    {
      "date": "2026-11-22",
      "coach": "Tong",
      "time": "11:00",
      "duration": 60,
      "preview": true
    },
    {
      "date": "2026-11-22",
      "coach": "Neung",
      "time": "14:00",
      "duration": 60,
      "preview": true
    },
    {
      "date": "2026-11-25",
      "coach": "David",
      "time": "10:00",
      "duration": 120,
      "preview": true
    },
    {
      "date": "2026-11-25",
      "coach": "Bia",
      "time": "10:00",
      "duration": 120,
      "preview": true
    },
    {
      "date": "2026-11-25",
      "coach": "Tong",
      "time": "12:30",
      "duration": 120,
      "preview": true
    }
  ],
  "sales": [
    [
      "08:12",
      "Court 1 · 60 min",
      "QR code",
      800,
      {
        "payer": "Arun S.",
        "bank": "Kasikornbank",
        "reference": "DEMO-0001"
      },
      "Court 1"
    ],
    [
      "09:04",
      "Water × 2",
      "Cash",
      40
    ],
    [
      "09:48",
      "Private coaching · 60 min",
      "QR code",
      2000,
      {
        "payer": "Mina T.",
        "bank": "Siam Commercial Bank",
        "reference": "DEMO-0002"
      },
      null,
      {
        "category": "coaches",
        "coach": "David"
      }
    ],
    [
      "10:19",
      "Iced coffee × 2",
      "Cash",
      160
    ],
    [
      "11:06",
      "Private reformer session",
      "Credit card",
      1500,
      {
        "payer": "Lina P.",
        "bank": "Bangkok Bank",
        "reference": "DEMO-0003",
        "card": "Visa •••• 4821"
      },
      null,
      {
        "category": "pilates",
        "group": "Room 1"
      }
    ],
    [
      "12:33",
      "Electrolyte drink × 3",
      "QR code",
      180,
      {
        "payer": "Noah K.",
        "bank": "Krungthai Bank",
        "reference": "DEMO-0004"
      }
    ],
    [
      "13:21",
      "Annual Padel membership",
      "Credit card",
      3500,
      {
        "payer": "Nora W.",
        "bank": "Kasikornbank",
        "reference": "DEMO-0005",
        "card": "Mastercard •••• 7306"
      },
      null,
      {
        "category": "memberships"
      }
    ],
    [
      "14:08",
      "Racket rental × 2",
      "Cash",
      200
    ],
    [
      "15:42",
      "Bullpadel Pearl 27",
      "Credit card",
      15000,
      {
        "payer": "Sofia R.",
        "bank": "Krungsri",
        "reference": "DEMO-0006",
        "card": "Visa •••• 1064"
      }
    ],
    [
      "16:25",
      "Coaching package · 5 lessons",
      "QR code",
      9000,
      {
        "payer": "Theo M.",
        "bank": "Bangkok Bank",
        "reference": "DEMO-0007"
      },
      null,
      {
        "category": "packages",
        "group": "padel5"
      }
    ],
    [
      "17:36",
      "Court 3 · 90 min",
      "QR code",
      1500,
      {
        "payer": "Ploy N.",
        "bank": "Siam Commercial Bank",
        "reference": "DEMO-0008"
      },
      "Court 3"
    ],
    [
      "18:14",
      "Sparkling water × 2",
      "Cash",
      100
    ]
  ]
}
$demo$::jsonb);
commit;
