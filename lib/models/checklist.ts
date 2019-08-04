import { get } from "../utils/get";

// TODO: Implement duplication validation

export interface ChecklistItem {
  id: string;
  checked: boolean;
  body: string;
}

export interface Checklist {
  id: string;
  namespace: string;
  items: ChecklistItem[];
}

export interface ChecklistGroup {
  [checklistID: string]: Checklist;
}

export interface ChecklistCollection {
  [namespace: string]: ChecklistGroup;
}

const CHECKS = /^- \[(x|X| )\] <!-- (\w+:\w+:\w+) --> (.*)/gm;
const CHECK_DETAILS = /^- \[(x|X| )\] <!-- (\w+:\w+:\w+) --> (.*)/;

export const createChecklist = (namespace: string, checklistId: string, items: ChecklistItem[]) =>
  items
    .map(({ id, checked, body }) => `- [${checked ? "x" : " "}] <!-- ${namespace}:${checklistId}:${id} --> ${body}`)
    .join("\n");

export function parseChecklists(text: string): ChecklistCollection;
export function parseChecklists(text: string, namespace: string): { [checklistID: string]: Checklist };

export function parseChecklists(text: string, namespace?: string) {
  const checklists: ChecklistCollection = {};

  (text.match(CHECKS) || [])
    .map(check => check.match(CHECK_DETAILS))
    .filter(check => check !== null)
    .forEach(check => {
      let checked = !!check![1].trim();
      const [namespace, checklistID, checkID] = check![2].split(":");
      const body = check![3];

      checklists[namespace] = {
        ...checklists[namespace],
        [checklistID]: {
          id: checklistID,
          namespace,
          items: [
            ...get(checklists, c => c[namespace][checklistID].items, []),
            {
              id: checkID,
              checked,
              body,
            },
          ],
        },
      };
    });
  return namespace ? checklists[namespace] : checklists;
}

export const atMostOneItemChecked = (checklist: Checklist) =>
  checklist.items.reduce((total, item) => (item.checked ? total + 1 : total), 0) <= 1;
