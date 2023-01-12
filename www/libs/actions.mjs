let fileActions = []

export function addFileAction(mime, {gotoPath, title, componentName, componentPath} = {}){
  if(!gotoPath && !componentName) return;
  if(!componentPath && componentName) componentPath = `/components/${componentName}.mjs`;
  if(!title) title = `New Action (${componentName||path})`;
  fileActions.push({id: fileActions.length+1, mime, title, gotoPath, componentName, componentPath})
}

export function getFileActions(mime){
  return fileActions.filter(a => a.mime == mime)
}