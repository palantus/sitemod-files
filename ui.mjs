export let menu = [
  {
    title: "Me",
    items: [
      {title: "Files", path: "/files/mine", permission: "file.read"}
    ]
  },
  {
    title: "Files",
    items: [
      {title: "Drop", path: "/drop"},
      {title: "Shared files", path: "/files/shared", permission: "file.read"}
    ]
  }
]