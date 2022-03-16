import { query } from "entitystorage"
import File from "../models/file.mjs"

export function startCleanupService(){
  return setInterval(runJob, 3_500_000) // Run every hour (ish)
}

function runJob(){
  console.time("Files Cleanup completed")

  let todayStrISO = new Date().toISOString()

  query.type(File).tag("file").tag("temp").prop("expire").all
       .filter(f => f.expire < todayStrISO)
       .forEach(f => f.delete())

  console.timeEnd("Files Cleanup completed")
}