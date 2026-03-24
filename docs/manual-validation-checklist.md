## Manual Validation Checklist

Use this after security/UI refactors that touched auth, chat, admin, revisor, or directives.

### 1. Login

- Open `login.html`.
- Verify normal login still redirects non-admin users to chat.
- Verify admin login still redirects to the dashboard.
- Refresh the page and confirm the restored session still works.

### 2. Dashboard

- Open `index.html` as admin.
- Confirm people cards render correctly.
- Confirm person photos still load.
- Confirm selecting a person opens `chat.html`.

### 3. Chat

- Send a normal message.
- Confirm ALMA response renders with markdown formatting.
- Confirm correction button still opens the modal for admin.
- Confirm suggestions still fill the input and send correctly.
- If voice is configured, confirm `Ouvir` still works.

### 4. Correction Modal

- Open the correction modal from a real ALMA response.
- Enter text and click `Analisar`.
- Confirm classification UI appears correctly.
- Change the type and save.
- Confirm corrections/directives persist and affect later behavior.

### 5. Directives Panel

- Open the directives side panel in chat as admin.
- Confirm directives load.
- Add a directive.
- Delete a directive.
- Confirm no console errors occur during these actions.

### 6. Admin Panel

- Open `admin.html`.
- Confirm chunks list and pagination render correctly.
- Edit one chunk and save.
- Open the corrections tab and test promote/deactivate/reactivate.
- Open the directives tab and edit/delete an existing directive.
- Open heirs tab and confirm list/check-in still render.

### 7. Revisor

- Open `revisor.html`.
- Confirm stats load.
- Filter by category/source.
- Expand a chunk, edit it, save it, and delete a test chunk if needed.

### 8. Security Smoke

- Open browser devtools console and confirm there are no new JS errors.
- Call protected endpoints without auth and confirm they still reject access.
- Confirm `get_persons` requires auth and `list_directives` requires admin.
