// Safe to expose in the public frontend. This file must contain ONLY the Supabase URL and public anon key.
// NEVER put a service_role key, secret key, or administrator credential here.
window.APP_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  studyTitle: "[Insert faculty-approved study title]",
  studyContact: "[Insert principal investigator name and institutional email]",
  ethicsContact: "[Insert faculty ethics committee contact]",
  ethicsApproval: "[Insert approval/reference number]",
  dataRetention: "[Insert approved retention period and storage jurisdiction]",
  consentVersion: "draft-1.0",
  appVersion: "0.2.1"
};