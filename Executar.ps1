$ultimo = Get-ChildItem .\qa_evidencias -Directory |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

Get-Content (Join-Path $ultimo.FullName "build.log") -Tail 90