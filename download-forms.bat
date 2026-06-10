@echo off
REM ── RTO Forms Downloader ──
REM Yeh script parivahan.gov.in se sabhi official blank PDFs download karega
REM Run karo: double-click → "forms" folder ban jayega
mkdir forms 2>nul
cd forms
for %%F in (FORM-1.pdf FORM-1A.pdf FORM-2.pdf FORM-3.pdf FORM-4A.pdf FORM-5.pdf FORM-6.pdf FORM-6A.pdf FORM-7.pdf FORM-8.pdf FORM-9.pdf FORM-LLD.pdf FORM-14.pdf FORM-15.pdf FORM-16.pdf FORM-17.pdf FORM-20.pdf FORM-21.pdf FORM-22.PDF FORM-23.pdf FORM-24.pdf FORM-25.pdf FORM-26.pdf FORM-27.pdf FORM-28.pdf FORM-29.pdf FORM-30.pdf FORM-31.pdf FORM-32.pdf FORM-33.pdf FORM-34.pdf FORM-35.pdf FORM-36.pdf FORM-38.pdf FORM-45.pdf FORM-46.pdf FORM-47.pdf FORM-48.pdf FORM-51.pdf FORM-54.pdf) do (
  echo Downloading %%F ...
  curl -s -O "https://parivahan.gov.in/sites/default/files/DownloadForm/cmvr/%%F"
)
echo.
echo ── Done! "forms" folder ready hai ──
echo Ab is folder ko GitHub repo me upload karo
pause
