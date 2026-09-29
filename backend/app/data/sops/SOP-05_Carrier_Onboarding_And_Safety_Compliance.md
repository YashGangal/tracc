# Standard Operating Procedure: SOP-05 - Carrier Onboarding & Safety Compliance Verification

**Effective Date:** January 1, 2026  
**Department:** Carrier Compliance & Risk Management  
**Audience:** Carrier Procurement Specialists, Onboarding Teams, Dispatchers  

---

## 1. Carrier Qualification Thresholds
Prior to tendering any freight or entering into a broker-carrier agreement, a motor carrier must satisfy all FMCSA and internal safety criteria:

### Mandatory Minimum Standards:
1. **Active Operating Authority:** Verified common or contract authority active for a minimum of **90 consecutive days**.
2. **Safety Rating:** FMCSA Safety Rating must be **Satisfactory** or **None/Unrated**. Carriers with a "Conditional" or "Unsatisfactory" rating are strictly barred.
3. **Insurance Requirements:**
   - **Auto Liability:** Minimum $1,000,000 combined single limit (CSL).
   - **Motor Truck Cargo (MTC):** Minimum $100,000 policy limit without unattended vehicle exclusions.
   - **Worker's Compensation:** Required as statutory by home state.
   - Certificate of Insurance (COI) must name our brokerage as Certificate Holder with 30-day notice of cancellation.
4. **Safety Measurement System (SMS) BASIC Percentiles:**
   - Unsafe Driving: Must be below 65%.
   - Crash Indicator: Must be below 65%.
   - HOS Compliance: Must be below 70%.

## 2. Onboarding Workflow
1. Carrier completes electronic onboarding pack via vendor portal.
2. Compliance engine validates DOT/MC numbers via real-time FMCSA Safer Web API.
3. W-9 Tax Identification Form verified against IRS records.
4. If approved, carrier status set to `active`. If insurance expires, carrier status switches automatically to `probation` or `suspended` and dispatch locks engage.
