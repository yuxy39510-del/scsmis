$root = $PSScriptRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  学生选课管理系统 SCSMIS" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "[1/2] 启动 Web 服务器 (端口 3000) ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit -Command `"cd '$root'; Write-Host 'Web服务器已启动 http://localhost:3000' -ForegroundColor Green; node app.js`"" -WorkingDirectory $root

Write-Host "[2/2] 启动 ngrok 公网隧道 ..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
Start-Process powershell -ArgumentList "-NoExit -Command `"cd '$root'; Write-Host '========================================' -ForegroundColor Cyan; Write-Host '  公网隧道启动中...' -ForegroundColor Green; Write-Host '  复制下面 Forwarding 行中的 https:// 地址' -ForegroundColor Yellow; Write-Host '  发给任何人即可访问！' -ForegroundColor Yellow; Write-Host '========================================' -ForegroundColor Cyan; .\ngrok.exe http 3000`"" -WorkingDirectory $root

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  启动完成！" -ForegroundColor Green
Write-Host "  本地访问: http://localhost:3000/login" -ForegroundColor White
Write-Host "  公网地址: 查看 ngrok 窗口中的 Forwarding 行" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "按 Enter 关闭此窗口（不影响服务运行）"
