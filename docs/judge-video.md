# 3-Minute Judge Walkthrough Video

Watch or download the project-focused walkthrough:

[fiber-merchant-kit-project-run-3-minute.mp4](assets/fiber-merchant-kit-project-run-3-minute.mp4)

<video src="assets/fiber-merchant-kit-project-run-3-minute.mp4" controls width="100%"></video>

This video is intentionally focused on the project, not only the UI demo. It shows what Fiber Merchant Kit solves, how the repository is structured, how a judge can run it on a fresh laptop, and how to verify the implementation before reviewing the hosted demo.

## What It Covers

| Time | Segment | Judge Takeaway |
|---|---|---|
| 0:00 | Problem and solution | Fiber needs merchant-ready infrastructure around FNN RPC |
| 0:20 | Architecture | API server is the trust boundary between apps, Fiber RPC, persistence, and webhooks |
| 0:40 | Terminal setup | Clone, install dependencies, and confirm Node/npm prerequisites |
| 1:00 | Local run | `npm run dev` starts API, dashboard, and FiberStore together |
| 1:25 | Dashboard and store rules | Merchants use an API key; shoppers never need one |
| 1:55 | Verification | `npm run judge:verify` runs smoke tests, workspace tests, type checks, and builds |
| 2:25 | Hosted demo | Fly deployment exposes `/dashboard` and `/store` from one public origin |
| 2:45 | Evidence map | `JUDGES.md`, architecture docs, deployment docs, and testnet evidence guide deeper review |

## Commands Shown

```bash
git clone https://github.com/zynorr/fiber-merchant-kit.git
cd fiber-merchant-kit
npm install
npm run dev
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

The video is silent and captioned so it can be reviewed quickly in a noisy hackathon setting. The repository remains the source of truth for commands, tests, and evidence.

