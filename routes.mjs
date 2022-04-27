routes.push(...[
  {path: "/drop",                   page: "/pages/drop.mjs"},
  {path: "/filesources",            page: "/pages/filesources.mjs"},
  {regexp: /^\/file\/([a-zA-Z\d]+)/,page: "/pages/file.mjs", publicAccess: true},
  {regexp: /^\/folder\/(\d+)/,      page: "/pages/files.mjs", publicAccess: true},
  {regexp: /^\/files*/,             page: "/pages/files.mjs", publicAccess: true},
])