# Lab 2 — Peer Review Record

**Author:** Garunyapas Danpitakkul (Student ID: 67070503404, GitHub: @vienggg)  
**Peer Reviewer:** Dechayut (Student ID: 67070503414, GitHub: @NinjoMUDA)  
**Partner Repository:** [https://github.com/NinjoMUDA/Dechayut_3414Lab1](https://github.com/NinjoMUDA/Dechayut_3414Lab1)  
**Project Repository:** [https://github.com/vienggg/toktickit](https://github.com/vienggg/toktickit)  

---

## 1. Pull Requests I Authored (Reviewed & Merged by @NinjoMUDA)

| PR # | Title | Feature Branch | Target Branch | Status & Verdict |
|---|---|---|---|:---:|
| **#36** | Docs: Sprint 2 Engineering Contracts and Test Plan | `docs/lab2-spec-and-test-plan` | `lab2-staging` | [Approved & Merged](https://github.com/vienggg/toktickit/pull/36) |
| **#37** | Feat: Database Schema Extension and Seed Data | `feature/database-schema-and-seed` | `lab2-staging` | [Approved & Merged](https://github.com/vienggg/toktickit/pull/37) |
| **#38** | Feat: Development Requester Context and Simulated Login | `feature/dev-requester-context` | `lab2-staging` | [Approved & Merged](https://github.com/vienggg/toktickit/pull/38) |
| **#39** | Feat: Create Ticket API, Validation, and Zen Green Form UI | `feature/create-ticket-and-zen-ui` | `lab2-staging` | [Approved & Merged](https://github.com/vienggg/toktickit/pull/39) |
| **#40** | Feat: My Tickets Screen with Search, Filter, Sort and Pagination | `feature/my-tickets-search-and-filters` | `lab2-staging` | [Approved & Merged](https://github.com/vienggg/toktickit/pull/40) |
| **#41** | Feat: Ticket Detail Screen, Attachment Lifecycle, and In-Place Edit | `feature/ticket-detail-attachments-and-edit` | `lab2-staging` | [Approved & Merged](https://github.com/vienggg/toktickit/pull/41) |
| **#45** | Docs: Sprint 2 Verification, Test Matrix, and Release Polish | `docs/lab2-sprint2-release-and-report` | `lab2-staging` | [Approved & Merged](https://github.com/vienggg/toktickit/pull/45) |

### Substantive Review Comments Received & Responses:

#### PR #36: Sprint 2 Engineering Contracts
> **Reviewer Feedback (@NinjoMUDA):**  
> *"Verified docs/lab-02 contracts. The 13 Business Rules and 15 Acceptance Criteria are well-defined. Please ensure soft-removal reason retention is explicitly marked as mandatory in specification.md."*  
> 
> **Author Response (@vienggg):**  
> *"Updated BR-10 and AC-11 in specification.md to enforce non-empty removal reason in the soft-delete workflow."*

#### PR #37: Database Schema Extension & Seed Data
> **Reviewer Feedback (@NinjoMUDA):**  
> *"Schema and migrations look clean. Unit tests UNIT-01 and UNIT-02 verify ticket number format TKT-YYYY-XXXXXX. Seed script properly seeds 4 active requesters and 1 inactive user."*  
> 
> **Author Response (@vienggg):**  
> *"Confirmed seed idempotency and verified foreign key onDelete constraints."*

#### PR #38: Development Requester Context & Simulated Login
> **Reviewer Feedback (@NinjoMUDA):**  
> *"Tested simulated login modal. GET /api/dev/requesters correctly excludes Alex Taylor (isActive: false). LocalStorage persistence works on page refresh."*  
> 
> **Author Response (@vienggg):**  
> *"Added UI-01 test asserting navbar identity pill updates dynamically upon context switch."*

#### PR #39: Create Ticket API, Validation & Zen Green UI
> **Reviewer Feedback (@NinjoMUDA):**  
> *"Multer multipart upload handles 5MB limit and rejects disallowed file extensions. Form busy state prevents double submission. Visual styling matches Zen Green palette."*  
> 
> **Author Response (@vienggg):**  
> *"Added unit tests API-03, API-04, API-05, and UI-02..03 validating field error messages."*

#### PR #40: My Tickets Screen with Search, Filter, Sort & Pagination
> **Reviewer Feedback (@NinjoMUDA):**  
> *"Tested requester data isolation: Jennifer Anderson's 12 tickets do not leak to Michael Brown. Multi-criteria filtering and pagination controls work smoothly."*  
> 
> **Author Response (@vienggg):**  
> *"Fixed search query parameter to match both summary and ticketNumber strings."*

#### PR #41: Ticket Detail Screen, Attachment Lifecycle & In-Place Edit
> **Reviewer Feedback (@NinjoMUDA):**  
> *"In-place edit updates database correctly. Attachment soft-removal marks isRemoved: true and retains metadata. Direct access to non-owned tickets returns 403 Forbidden."*  
> 
> **Author Response (@vienggg):**  
> *"Verified 29/29 automated tests passing across client and server."*

---

## 2. Pull Requests I Reviewed for Partner (@NinjoMUDA)

| PR # | Title | Feature Branch | Review Link | Verdict |
|---|---|---|---|:---:|
| **#18** | DB Schema Extension & Seed Data | `feature/database-schema-and-seed` | [Review Link](https://github.com/NinjoMUDA/Dechayut_3414Lab1/pull/18) | Approved |
| **#19** | Dev Requester Context & Login | `feature/dev-requester-context` | [Review Link](https://github.com/NinjoMUDA/Dechayut_3414Lab1/pull/19) | Approved |
| **#21** | Create Ticket Screen UI | `feature/create-ticket-and-zen-ui` | [Review Link](https://github.com/NinjoMUDA/Dechayut_3414Lab1/pull/21) | Approved |
| **#22** | My Tickets Screen & Filters | `feature/my-tickets-search-and-filters` | [Review Link](https://github.com/NinjoMUDA/Dechayut_3414Lab1/pull/22) | Approved |
| **#23** | Ticket Detail & Attachments | `feature/ticket-detail-attachments-and-edit` | [Review Link](https://github.com/NinjoMUDA/Dechayut_3414Lab1/pull/23) | Approved |

### My Review Feedback Given to Partner:
> *"Verified database seed data, multi-user isolation on My Tickets, attachment format rejection, and soft-removal modal behavior. Code looks clean and tests pass."*
