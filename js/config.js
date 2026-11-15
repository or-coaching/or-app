// =============================================================
// THE ONLY FILE YOU NEED TO EDIT
// =============================================================
export const CONFIG = {
  // true = sample data, no sign-up needed (for previews). Set to false when you go live.
  DEMO: false,

  // Business name shown in the app
  APP_NAME: "Or.",

  // From Supabase > Project Settings > API
  SUPABASE_URL: "https://gjopnbrjisuhlpgqdzzj.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdqb3BuYnJqaXN1aGxwZ3FkenpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ2OTU3MDMsImV4cCI6MjExMDI3MTcwM30.D0-s_3XcNAXN0QY6O_kdmxD8jLRZC6oKdiO7W4rXOFI",

  // Link to her privacy notice (POPIA). Can be a Google Doc or web page.
  PRIVACY_URL: "privacy.html",

  // Her Instagram (leave "" to hide)
  INSTAGRAM_URL: "https://www.instagram.com/or.collective/",

  // Payment links from PayFast / Yoco / Paystack (no coding — create them in their dashboard).
  // Leave "" to hide a button.
  // "days" = how long access lasts once she switches it on. Prices are placeholders.
  OFFERS: [
    { key: "pass5",   title: "5-day pass",  detail: "Full library and tracking",  price: "R79",    days: 5,  url: "" },
    { key: "pass7",   title: "7-day pass",  detail: "Full library and tracking",  price: "R99",    days: 7,  url: "" },
    { key: "pass30",  title: "30-day pass", detail: "Full library and tracking",  price: "R299",   days: 30, url: "" },
    { key: "session", title: "PT session",  detail: "One-on-one, 60 minutes",     price: "R350",   url: "" },
    { key: "package", title: "Monthly coaching", detail: "4 sessions plus programme", price: "R1,200", days: 30, url: "" },
  ],
  // Optional booking calendar (Calendly, Setmore, Google booking page)
  BOOKING_URL: "",

  // Exercise types shown as sections in the Library. Tanya can also add her own in the app.
  EXERCISE_TYPES: ["Warm-up", "Main set", "Cool-down", "Chill set", "Mobility", "Stretch", "Finisher"],

  // Shown on the health check every client completes before training.
  // Have a South African attorney check this wording before launch. Leave "" to use the default.
  WAIVER: "",

  // Her own photos (portrait, 1200px+). Put them in the images folder.
  // Leave "" and the app uses a branded background instead.
  PHOTOS: {
    welcome: "",   // sign-in screen, e.g. "images/welcome.jpg"
    today: "",     // client home hero, e.g. "images/today.jpg"
    passes: "",    // passes / library promo, e.g. "images/passes.jpg"
  },
};

// Brand colours — swap these to match her logo
export const BRAND = {
  primary: "#9CB59A",   // sage — buttons, highlights
  ink: "#171A18",       // green charcoal background
};
