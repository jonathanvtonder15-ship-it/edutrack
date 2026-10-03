import posthog from 'posthog-js'

posthog.init("phc_4jmAO0UnXCi20QLKWkgDuGipqoIID6LG4Zl0hg7ymt0", {
    api_host: "https://eu.i.posthog.com",
    defaults: '2026-01-30',
    autocapture: true,
})

posthog.register({
    ui_project_id: process.env.NEXT_PUBLIC_UI_PROJECT_ID ?? "",
})