<?php

$dir = __DIR__ . '/storage/app/public/samples';
if (!file_exists($dir)) {
    mkdir($dir, 0777, true);
}

$img = imagecreatetruecolor(400, 400);
$bg = imagecolorallocate($img, 34, 197, 94);
$tc = imagecolorallocate($img, 255, 255, 255);
imagefill($img, 0, 0, $bg);
imagestring($img, 5, 100, 190, 'Bukti Struk Kurir', $tc);
imagejpeg($img, $dir . '/sample_struk.jpg');
imagejpeg($img, $dir . '/sample_delivery.jpg');
imagedestroy($img);

echo "Sample images created successfully in " . $dir;
