let sessionId = null;
let importData = null;
let issueReport = { issues: [], issueIndexes: [], issueCount: 0 };
let showOnlyIssues = false;
let removedCount = 0;

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getIssueMap() {
    const map = new Map();
    for (const issue of issueReport.issues || []) {
        if (!map.has(issue.index)) map.set(issue.index, []);
        map.get(issue.index).push(issue);
    }
    return map;
}

function updateStatus() {
    const total = importData?.items?.length || 0;
    const issueCount = issueReport.issueCount || 0;
    const statusEl = document.getElementById('review-status');
    statusEl.textContent = `Items: ${total} active (${removedCount} removed). Issues: ${issueCount}.`;
}

function renderRows() {
    const rowsEl = document.getElementById('review-rows');
    const issueMap = getIssueMap();
    rowsEl.innerHTML = '';

    (importData?.items || []).forEach((item, index) => {
        const itemIssues = issueMap.get(index) || [];
        const hasIssue = itemIssues.length > 0;
        if (showOnlyIssues && !hasIssue) {
            return;
        }

        const tr = document.createElement('tr');
        if (hasIssue) tr.classList.add('import-review-row-issue');

        const statusText = hasIssue
            ? itemIssues.map((i) => i.reason).join(' | ')
            : 'OK';

        const escapedTitle = escapeHtml(item.title || '(untitled item)');
        const escapedId = escapeHtml(item.id || '');
        const escapedStatus = escapeHtml(statusText);

        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${escapedTitle}</td>
            <td>
                <input class="import-review-id-input" data-index="${index}" value="${escapedId}" />
            </td>
            <td>${escapedStatus}</td>
            <td>
                <button class="btn btn-danger" data-remove-index="${index}">Remove</button>
            </td>
        `;

        rowsEl.appendChild(tr);
    });
}

function getReviewDataForValidation() {
    const cleanedItems = (importData?.items || []).map((item) => {
        const clone = { ...item };
        clone.id = String(clone.id || '').trim();
        return clone;
    });

    return {
        items: cleanedItems,
        storyReferences: importData.storyReferences || {}
    };
}

async function validateAndRefresh() {
    const reviewedData = getReviewDataForValidation();
    issueReport = await window.api.invoke('validate-import-review-data', {
        sessionId,
        data: reviewedData
    });
    updateStatus();
    renderRows();
    return issueReport;
}

function bindEvents() {
    document.getElementById('show-only-issues').addEventListener('change', (e) => {
        showOnlyIssues = e.target.checked;
        renderRows();
    });

    document.getElementById('recheck-btn').addEventListener('click', async () => {
        try {
            await validateAndRefresh();
        } catch (error) {
            alert(`Error while rechecking issues: ${error.message}`);
        }
    });

    document.getElementById('continue-import-btn').addEventListener('click', async () => {
        try {
            const report = await validateAndRefresh();
            if (report.issueCount > 0) {
                alert(`There are still ${report.issueCount} issue(s). Fix or remove those items first.`);
                return;
            }

            const result = await window.api.invoke('finalize-import-review', {
                sessionId,
                data: getReviewDataForValidation()
            });

            if (!result?.success) {
                alert('Import did not complete. Please recheck issues.');
                return;
            }

            window.close();
        } catch (error) {
            alert(`Import failed: ${error.message}`);
        }
    });

    document.getElementById('close-review-btn').addEventListener('click', () => {
        window.close();
    });

    document.getElementById('review-rows').addEventListener('input', (event) => {
        const input = event.target;
        if (!input.classList.contains('import-review-id-input')) return;
        const index = Number(input.dataset.index);
        if (Number.isNaN(index) || !importData.items[index]) return;
        importData.items[index].id = input.value;
    });

    document.getElementById('review-rows').addEventListener('click', (event) => {
        const button = event.target.closest('button[data-remove-index]');
        if (!button) return;
        const index = Number(button.dataset.removeIndex);
        if (Number.isNaN(index) || !importData.items[index]) return;
        importData.items.splice(index, 1);
        removedCount += 1;
        renderRows();
        updateStatus();
    });
}

async function initializeImportReview() {
    const params = new URLSearchParams(window.location.search);
    sessionId = params.get('sessionId');

    if (!sessionId) {
        document.getElementById('review-status').textContent = 'Missing import review session id.';
        return;
    }

    try {
        const session = await window.api.invoke('get-import-review-session', sessionId);
        importData = {
            ...session.data,
            items: (session.data.items || []).map((item) => ({ ...item }))
        };
        issueReport = session.report || issueReport;

        updateStatus();
        renderRows();
    } catch (error) {
        document.getElementById('review-status').textContent = `Failed to load review data: ${error.message}`;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    bindEvents();
    await initializeImportReview();
});
