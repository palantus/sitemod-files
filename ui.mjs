export let menu = [
  {
    title: "Files",
    items: [
      {title: "Drop", path: "/drop"},
      {title: "Files", path: "/files", permission: "file.read"},
      {title: "Sources", path: "/filesources", permission: "file.source.manage"},
    ]
  }
]