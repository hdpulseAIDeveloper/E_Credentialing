# Hospital Privileges

Some Essen providers hold privileges at outside hospitals. The platform tracks each hospital affiliation through its own application-approval-renewal cycle.

## The record

Each hospital privilege record contains:

- Facility name and address
- Status: *Applied*, *Active*, *Provisional*, *Suspended*, *Lapsed*, *Terminated*
- Privilege level (admitting, consulting, courtesy)
- Privilege categories (the specific procedures and clinical privileges)
- Start date and renewal date
- The renewal cadence (typically every 2 years)

The **Hospital privileges** section on the provider's record lists every affiliation.

## Application tracking

When a provider applies for new privileges:

1. Open the provider's record → **Hospital privileges → Add**.
2. Enter the facility and the privilege level.
3. Upload the application packet to the documents section, linked to this privilege.
4. Set the status to *Applied*.

The platform creates reminder tasks at day 30, 60, and 90 for you to follow up with the hospital.

Once granted:

1. Update the status to *Active* (or *Provisional* if the hospital grants provisional initially).
2. Enter the start date and renewal date.
3. Upload the approval letter to the linked documents.

## Renewal cycle

Privilege renewals work like expirables:

- 120 days before renewal — first reminder to the specialist
- 90 days — reminder to begin re-application
- 60 days — Manager escalation if not yet started
- 30 days — urgent

Renewals require an updated application, often including a peer reference form and OPPE/FPPE summary (see [Performance evaluation](oppe-fppe.md)).

## The Privileging Library

The **Privileging Library** is a catalog of privilege delineations by specialty. It is used to:

- Prefill privilege categories on a new application (matching the hospital's form)
- Generate a machine-readable description for FHIR
- Report privilege rollups across Essen

Admins maintain the library under **Administration → Privileging Library**.

## Suspensions and lapses

If privileges lapse or are suspended:

1. Open the record → **Actions → Record event**.
2. Choose *Suspension* or *Lapse*, enter the reason and effective date.
3. Upload any letter from the hospital.

Suspensions are escalated to the CMO immediately — they are a quality signal the committee must review.

## FAQ

**Q: We do not yet have privileges at any hospital — do we still need this module?**
A: Keep it enabled even if unused today. As Essen expands into hospital-based specialties, it is ready.

**Q: Can a provider have privileges at multiple facilities?**
A: Yes — each facility is a separate record with its own renewal cycle.

**Q: What about telehealth-only providers?**
A: Telehealth privileges are tracked under the Telehealth Credentialing module rather than here.
