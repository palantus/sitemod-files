routes.push(...[
  {path: "/files",                  page: "/pages/files.mjs"},
  {regexp: /\/file\/(\d+)/,         page: "/pages/file.mjs"},
  {path: "/filesources",            page: "/pages/filesources.mjs"},
])