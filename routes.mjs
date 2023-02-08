routes.push(...[
  {path: "/drop",                   page: "/pages/drop.mjs"},
  {regexp: /^\/file\/download\/([a-zA-Z\d]+)/,page: "/pages/download.mjs", publicAccess: true},
  {regexp: /^\/file\/([a-zA-Z\d]+)/,page: "/pages/file.mjs", publicAccess: true},
  {regexp: /^\/folder\/(\d+)/,      page: "/pages/files.mjs", publicAccess: true},
  {regexp: /^\/files-search/,       page: "/pages/files-search.mjs", publicAccess: true},
  {regexp: /^\/files*/,             page: "/pages/files.mjs", publicAccess: true},
])