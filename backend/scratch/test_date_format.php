<?php

require 'c:/Users/ASRUL/Desktop/web Al Mannan/higo-pondok/backend/vendor/autoload.php';
use Carbon\Carbon;

function getIndonesianDateFolder($date = null): string
{
    $carbon = $date ? Carbon::parse($date)->setTimezone('Asia/Jakarta') : Carbon::now('Asia/Jakarta');
    $days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    $months = [
        1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April',
        5 => 'Mei', 6 => 'Juni', 7 => 'Juli', 8 => 'Agustus',
        9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember'
    ];

    $dayName = strtolower($days[$carbon->dayOfWeek]); // 'senin', 'kamis', etc.
    $dayNum = $carbon->day; // 18
    $monthName = $months[$carbon->month]; // 'Januari'
    $year = $carbon->year; // 2025

    return "{$dayName}{$dayNum}{$monthName}{$year}";
}

echo "Contoh 18 Jan 2025: " . getIndonesianDateFolder('2025-01-18') . "\n";
echo "Hari Ini: " . getIndonesianDateFolder() . "\n";
