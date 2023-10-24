let fileActions = []

export function addFileAction(mime, {gotoPath, dialog, title, componentName, componentPath, access, permission} = {}){
  if(!gotoPath && !componentName && !dialog) return;
  if(!componentPath && componentName) componentPath = `/components/${componentName}.mjs`;
  if(!title) title = `New Action (${componentName||path})`;
  fileActions.push({id: fileActions.length+1, mime, title, gotoPath, componentName, dialog, componentPath, access, permission})
}

export function getFileActions(mime){
  return fileActions.filter(a => a.mime == mime)
}