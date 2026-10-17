package runs

import (
	"bytes"
	"context"
	"fmt"
	"html/template"

	"app/internal/db"
	"app/internal/mail"
	"app/internal/runlog"
)

// alertLogLines is how much of the log a failure email quotes: enough to show the error and
// what led to it, the rest is on the plan's page.
const alertLogLines = 40

// Plain like the account emails: a sentence, the error, the end of the log and a link.
var failureHTML = template.Must(template.New("failure").Parse(`<p>The backup of {{.Plan}} failed.</p>
<p><strong>{{.Error}}</strong></p>
<pre style="font-size: 12px; white-space: pre-wrap">{{.Log}}</pre>
<p><a href="{{.Link}}">Open the plan</a></p>
<p>{{.App}}</p>
`))

type failureContent struct {
	App   string
	Plan  string
	Error string
	Log   string
	Link  string
}

// alert emails every admin with a verified address that a run failed. It runs after the run is
// recorded; a failed send is logged and does not change the run.
func (w *Worker) alert(ctx context.Context, run db.Run, plan *db.Plan, runErr error, log *runlog.Log) {
	recipients, err := w.queries.ListAlertRecipients(ctx)
	if err != nil {
		w.logger.Error("Could not list who to tell about a failed run", "run", run.ID, "error", err)
		return
	}
	content := failureContent{
		App:   w.appName,
		Plan:  plan.Name,
		Error: runErr.Error(),
		Log:   log.Tail(alertLogLines),
		Link:  fmt.Sprintf("%s/plans/%d/edit", w.frontendURL, plan.ID),
	}
	var html bytes.Buffer
	if err := failureHTML.Execute(&html, content); err != nil {
		w.logger.Error("Could not render the failed run email", "run", run.ID, "error", err)
		return
	}
	text := "The backup of " + content.Plan + " failed.\n\n" + content.Error + "\n\n" + content.Log + "\n\n" + content.Link + "\n\n" + content.App + "\n"
	for _, to := range recipients {
		msg := mail.Message{To: []string{to}, Subject: "Backup failed: " + plan.Name, Text: text, HTML: html.String()}
		if err := w.mail.Send(ctx, msg); err != nil {
			w.logger.Error("Could not send the failed run email", "run", run.ID, "to", to, "error", err)
		}
	}
}
