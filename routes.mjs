routes.push(...[
  {path: "/drop",                   page: "/pages/drop.mjs"},
  {path: "/filesources",            page: "/pages/filesources.mjs"},
  {regexp: /\/file\/(\d+)/,         page: "/pages/file.mjs"},
  {regexp: /\/files*/,              page: "/pages/files.mjs"},
])