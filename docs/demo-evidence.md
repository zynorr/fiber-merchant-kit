# Demo Checkout Evidence

This document records a live local demo checkout run for hackathon review.

## Run Context

| Field | Value |
|---|---|
| Date | July 7, 2026 |
| API | `http://localhost:3001` |
| Dashboard | `http://localhost:5173` |
| Demo Store | `http://localhost:5174` |
| Mode | Demo Fiber client |
| Store action | Added `Cyber Widget` and paid through the demo payment action |

## Verified Flow

| Step | Result |
|---|---|
| Store API key loaded | Passed |
| Store cart checkout | Passed |
| Invoice creation | Passed |
| Demo payment simulation | Passed |
| Invoice status after payment | `paid` |
| Transaction creation | Passed |

## Evidence Transaction

| Field | Value |
|---|---|
| Invoice ID | `ebbd43bf-6b04-4248-a670-b9476f0bd92d` |
| Invoice status | `paid` |
| Amount | `5000` |
| Currency | `CKB` |
| Payment hash | `47e8454134a8090976d6784a721d7c474cfd8ef29f7d6c773e24e26e76c7c37e` |
| Invoice address | `fibtNDdlODQ1NDEzNGE4MDkwOTc2ZDY3ODRhNzIxZDdj` |
| Transaction ID | `987865e5-6d8c-47df-9d8c-ea906598a3b8` |
| Transaction status | `Succeeded` |
| Transaction direction | `incoming` |
| Transaction description | `Demo store order: Cyber Widget x1` |

This proves the local storefront can create a Merchant API invoice, complete a demo payment, mark the invoice paid, and promote the incoming payment transaction to `Succeeded`.
