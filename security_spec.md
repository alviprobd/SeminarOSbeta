# Security Specification: Seminar OS

This document outlines the data invariants and adversarial payloads used to verify the security of the Seminar OS Firestore database.

## 1. Data Invariants

- **Users**: Users cannot set their own role during creation unless they are an admin or it defaults to 'student'. Users can only edit their own profile.
- **Seminars**: Only admins can manage seminars.
- **Registrations**: Students can only register themselves. Admins can manage all registrations.
- **Attendance**: Records must link a valid seminar and student. Only admins can mark or update attendance in bulk, though students might be allowed to check in if specific logic is implemented (currently admin-driven).
- **Certificates**: Only admins can issue certificates. Certificates are read-only for students once issued, but publicly verifiable.
- **Certificate Templates**: Only admins can manage templates.
- **Feedback**: Students can only submit feedback for seminars they attended/registered for.
- **Email Logs**: Only admins can view logs.
- **Site Settings**: Only admins can view and modify settings.

## 2. The "Dirty Dozen" Payloads

1. **Identity Spoofing**: Create a user document with someone else's UID.
2. **Privilege Escalation**: Create a user document with `role: 'admin'`.
3. **Invalid ID Injection**: Use a 2KB string as a document ID to bloat the database.
4. **Shadow Field Injection**: Add `isVerified: true` to a registration document where it's not allowed.
5. **Orphaned Registration**: Register for a `seminarId` that doesn't exist.
6. **Double Feedback**: Submit feedback for a seminar as another student.
7. **Timestamp Forgery**: Set `createdAt` to a date in the future or past instead of `request.time`.
8. **Setting Snoping**: Read `siteSettings/general` as a student.
9. **Log Scraping**: List all `emailLogs` as a student.
10. **Template Sabotage**: Delete a certificate template owned by another admin (if multiple admins exist).
11. **Outcome Tampering**: Change the `winner` or `status` of a completed seminar.
12. **PII Leakage**: Read another user's email address if it's not public.

## 3. Test Runner Plan

We will implement `firestore.rules.test.ts` (conceptual) to ensure these are blocked.
