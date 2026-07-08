# 3-Minute Judge Walkthrough Video

Watch or download the polished competition walkthrough:

[fiber-merchant-kit-project-run-3-minute.mp4](assets/fiber-merchant-kit-project-run-3-minute.mp4)

<video src="assets/fiber-merchant-kit-project-run-3-minute.mp4" controls width="100%"></video>

This video is intentionally focused on the project, not only the UI demo. It shows what Fiber Merchant Kit solves, how the repository is structured, the terminal path judges can follow on a fresh laptop, and how to verify the implementation before reviewing the hosted demo.

## What It Covers

| Time | Segment | Judge Takeaway |
|---|---|---|
| 0:00 | Competition cold open | Merchant API, keyless FiberStore, signed webhooks, SDKs, and dashboard |
| 0:08 | Adoption gap | Fiber is fast, but merchants need checkout, lifecycle, webhooks, and operations |
| 0:21 | Architecture | API server is the trust boundary between apps, Fiber RPC, persistence, and webhooks |
| 0:34 | Repo map | Where judges should inspect source, docs, architecture, and evidence |
| 0:44 | Terminal setup | Clone the repo, confirm Node/npm, and install dependencies |
| 0:59 | Terminal start | `npm run dev` starts API, dashboard, and FiberStore together |
| 1:15 | Terminal local URLs | Open API, dashboard, and FiberStore; merchant key stays out of shopper checkout |
| 1:29 | Hosted store proof | FiberStore checkout creates and completes a demo invoice from the public Fly URL |
| 1:44 | Dashboard proof | Merchant dashboard sees paid invoice, transaction, stats, and operations surfaces |
| 1:57 | Terminal verification | `npm run judge:verify` runs smoke tests, workspace tests, type checks, and builds |
| 2:15 | Testnet readiness | Demo mode is easy to judge; real FNN smoke is documented separately |
| 2:28 | Final hosted smoke | Latest evidence records paid invoice, transaction, stats, and green CI |
| 2:43 | Submission checklist | Repo, live demo, review guide, evidence docs, and video page |

## Commands Shown

```bash
git clone https://github.com/zynorr/fiber-merchant-kit.git
cd fiber-merchant-kit
npm install
npm run dev
open http://localhost:3001
open http://localhost:5173
open http://localhost:5174
npm run judge:verify
```

## URLs Shown

| Target | URL |
|---|---|
| Local API | `http://localhost:3001` |
| Local dashboard | `http://localhost:5173` |
| Local FiberStore | `http://localhost:5174` |
| Hosted judge demo | `https://fiber-merchant-kit-zynorr.fly.dev` |

## Notes For Judges

The video is silent and captioned so it can be reviewed quickly in a noisy hackathon setting. The terminal sections are deliberately preserved because they show exactly how a judge can run and verify the project. The repository remains the source of truth for commands, tests, and evidence.
