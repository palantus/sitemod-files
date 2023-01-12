import {addFileAction} from "/libs/actions.mjs"

export async function load(){
  addFileAction("text/plain", {title: "Edit", componentName: "file-edit-text-component", access: "w", permission: "file.edit"})
}