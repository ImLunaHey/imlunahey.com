import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { Dropzone } from './dropzone';
import { DownloadCanvasButton } from './download-canvas-button';
import { BackgroundColourPicker } from './background-colour-picker';
import { cn } from '../../../cn';
import { useSearchParams } from '../hooks/use-search-params';
import { Button } from './button';
import { SlideyBoi } from './slidey-boi';
import { PickyPal } from './picky-pal';
import gifFrames, { FrameData } from 'gif-frames/dist/gif-frames';
import { draw } from '../common/drawing/draw';
import { GradientPicker } from './gradient-picker';
import { rgbaToHex } from '../common/colours/rgba-to-hex';
import { centerImage } from '../common/drawing/center-image';
import { RotateIcon } from './icons/rotate-icon';
import { FlipHorizontalIcon } from './icons/flip-horizontal-icon';
import { FlipVerticalIcon } from './icons/flip-vertical-icon';
import { Sidebar } from './sidebar';
import { flipImage } from '../common/drawing/flip-image';
import { RefreshIcon } from './icons/refresh-icon';
import { generateColor } from '../common/colours/generate-hsl-color';
import { CanvasRatio, canvasRatioToSize, canvasRatios } from '../common/canvas-ratio';
import { Position } from '../common/position';
import { Buffer } from 'buffer';

const imageFileNames = [
  'imlunahey_3d_wallpapers_of_water_splashes_in_the_ocean_in_the_b327bffc-94c7-4314-a669-c86bfab3a17a_0.png',
  'imlunahey_3d_wallpapers_of_water_splashes_in_the_ocean_in_the_b327bffc-94c7-4314-a669-c86bfab3a17a_1.png',
  'imlunahey_3d_wallpapers_of_water_splashes_in_the_ocean_in_the_b327bffc-94c7-4314-a669-c86bfab3a17a_2.png',
  'imlunahey_3d_wallpapers_of_water_splashes_in_the_ocean_in_the_b327bffc-94c7-4314-a669-c86bfab3a17a_3.png',
  'imlunahey_a_beautiful_image_of_ocean_colors_in_a_watery_view__ef7faa5a-66af-4389-8741-083b07da80ef_0.png',
  'imlunahey_a_beautiful_image_of_ocean_colors_in_a_watery_view__ef7faa5a-66af-4389-8741-083b07da80ef_1.png',
  'imlunahey_a_beautiful_image_of_ocean_colors_in_a_watery_view__ef7faa5a-66af-4389-8741-083b07da80ef_2.png',
  'imlunahey_a_beautiful_image_of_ocean_colors_in_a_watery_view__ef7faa5a-66af-4389-8741-083b07da80ef_3.png',
  'imlunahey_a_splash_of_blue_orange_and_green_over_water_waves__de296173-e858-4410-a040-ff679eff9b17_0.png',
  'imlunahey_a_splash_of_blue_orange_and_green_over_water_waves__de296173-e858-4410-a040-ff679eff9b17_1.png',
  'imlunahey_a_splash_of_blue_orange_and_green_over_water_waves__de296173-e858-4410-a040-ff679eff9b17_2.png',
  'imlunahey_a_splash_of_blue_orange_and_green_over_water_waves__de296173-e858-4410-a040-ff679eff9b17_3.png',
  'imlunahey_abstract_sea_in_blue_and_orange_with_waves_in_the_s_70d32e86-fd8a-4abd-b518-0c2eaf7345a6_0.png',
  'imlunahey_abstract_sea_in_blue_and_orange_with_waves_in_the_s_70d32e86-fd8a-4abd-b518-0c2eaf7345a6_1.png',
  'imlunahey_abstract_sea_in_blue_and_orange_with_waves_in_the_s_70d32e86-fd8a-4abd-b518-0c2eaf7345a6_2.png',
  'imlunahey_abstract_sea_in_blue_and_orange_with_waves_in_the_s_70d32e86-fd8a-4abd-b518-0c2eaf7345a6_3.png',
  'imlunahey_an_abstract_image_of_sea_waves_and_splashes_in_the__6b58323b-7223-4fcd-a0c2-a83442459492_0.png',
  'imlunahey_an_abstract_image_of_sea_waves_and_splashes_in_the__6b58323b-7223-4fcd-a0c2-a83442459492_1.png',
  'imlunahey_an_abstract_image_of_sea_waves_and_splashes_in_the__6b58323b-7223-4fcd-a0c2-a83442459492_2.png',
  'imlunahey_an_abstract_image_of_sea_waves_and_splashes_in_the__6b58323b-7223-4fcd-a0c2-a83442459492_3.png',
  'imlunahey_an_image_of_beautiful_water_wave_in_the_style_of_da_7efdf1ee-8058-4114-9c40-d3f922becb56_0.png',
  'imlunahey_an_image_of_beautiful_water_wave_in_the_style_of_da_7efdf1ee-8058-4114-9c40-d3f922becb56_1.png',
  'imlunahey_an_image_of_beautiful_water_wave_in_the_style_of_da_7efdf1ee-8058-4114-9c40-d3f922becb56_2.png',
  'imlunahey_an_image_of_beautiful_water_wave_in_the_style_of_da_7efdf1ee-8058-4114-9c40-d3f922becb56_3.png',
  'imlunahey_cloud_pattern_wallpaper_2_top_25_android_wallpapers_69a02d2a-9405-4f6a-8a23-ca20f5be8aa6_0.png',
  'imlunahey_cloud_pattern_wallpaper_2_top_25_android_wallpapers_69a02d2a-9405-4f6a-8a23-ca20f5be8aa6_1.png',
  'imlunahey_cloud_pattern_wallpaper_2_top_25_android_wallpapers_69a02d2a-9405-4f6a-8a23-ca20f5be8aa6_2.png',
  'imlunahey_cloud_pattern_wallpaper_2_top_25_android_wallpapers_69a02d2a-9405-4f6a-8a23-ca20f5be8aa6_3.png',
  'imlunahey_cool_images_of_waves_in_the_style_of_colorful_turbu_34f5ad58-7ace-49c5-a007-2c7f554cfde4_0.png',
  'imlunahey_cool_images_of_waves_in_the_style_of_colorful_turbu_34f5ad58-7ace-49c5-a007-2c7f554cfde4_1.png',
  'imlunahey_cool_images_of_waves_in_the_style_of_colorful_turbu_34f5ad58-7ace-49c5-a007-2c7f554cfde4_2.png',
  'imlunahey_cool_images_of_waves_in_the_style_of_colorful_turbu_34f5ad58-7ace-49c5-a007-2c7f554cfde4_3.png',
  'imlunahey_splashing_ocean_waves_in_the_air_desktop_wallpaper__d88c4170-bbf2-4a08-99e1-e40de50e1521_0.png',
  'imlunahey_splashing_ocean_waves_in_the_air_desktop_wallpaper__d88c4170-bbf2-4a08-99e1-e40de50e1521_1.png',
  'imlunahey_splashing_ocean_waves_in_the_air_desktop_wallpaper__d88c4170-bbf2-4a08-99e1-e40de50e1521_2.png',
  'imlunahey_splashing_ocean_waves_in_the_air_desktop_wallpaper__d88c4170-bbf2-4a08-99e1-e40de50e1521_3.png',
  'imlunahey_the_abstract_image_of_pink_and_blue_colors_in_the_s_aa778ece-ee52-4e4f-9d72-9f526a3e3f6b_0.png',
  'imlunahey_the_abstract_image_of_pink_and_blue_colors_in_the_s_aa778ece-ee52-4e4f-9d72-9f526a3e3f6b_1.png',
  'imlunahey_the_abstract_image_of_pink_and_blue_colors_in_the_s_aa778ece-ee52-4e4f-9d72-9f526a3e3f6b_2.png',
  'imlunahey_the_abstract_image_of_pink_and_blue_colors_in_the_s_aa778ece-ee52-4e4f-9d72-9f526a3e3f6b_3.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_04a6fa6c-ba9e-427c-aef0-0c83a0110d2d_0.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_04a6fa6c-ba9e-427c-aef0-0c83a0110d2d_1.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_04a6fa6c-ba9e-427c-aef0-0c83a0110d2d_2.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_04a6fa6c-ba9e-427c-aef0-0c83a0110d2d_3.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_0527e128-3775-430f-ad21-ef2e1303192e_0.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_0527e128-3775-430f-ad21-ef2e1303192e_1.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_0527e128-3775-430f-ad21-ef2e1303192e_2.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_0527e128-3775-430f-ad21-ef2e1303192e_3.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_1b273d1d-8dd1-4d8a-89d4-1b2481fed417_0.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_1b273d1d-8dd1-4d8a-89d4-1b2481fed417_1.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_1b273d1d-8dd1-4d8a-89d4-1b2481fed417_2.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_1b273d1d-8dd1-4d8a-89d4-1b2481fed417_3.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_2479cb68-786b-4b45-bd3b-2d61eb736831_0.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_2479cb68-786b-4b45-bd3b-2d61eb736831_1.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_2479cb68-786b-4b45-bd3b-2d61eb736831_2.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_2479cb68-786b-4b45-bd3b-2d61eb736831_3.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_25bf7ecb-3ce7-497f-80f1-5d694a3425b2_0.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_25bf7ecb-3ce7-497f-80f1-5d694a3425b2_1.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_25bf7ecb-3ce7-497f-80f1-5d694a3425b2_2.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_25bf7ecb-3ce7-497f-80f1-5d694a3425b2_3.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_2a03da6e-078e-4b70-a90d-0baf6bbb5830_0.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_2a03da6e-078e-4b70-a90d-0baf6bbb5830_1.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_2a03da6e-078e-4b70-a90d-0baf6bbb5830_2.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_2a03da6e-078e-4b70-a90d-0baf6bbb5830_3.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_2e65175c-892a-4cf5-8c8b-77172aaaf300_0.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_2e65175c-892a-4cf5-8c8b-77172aaaf300_1.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_2e65175c-892a-4cf5-8c8b-77172aaaf300_2.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_2e65175c-892a-4cf5-8c8b-77172aaaf300_3.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_445683ba-6ff5-42b6-8496-895c9b3ed4ee_0.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_445683ba-6ff5-42b6-8496-895c9b3ed4ee_1.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_445683ba-6ff5-42b6-8496-895c9b3ed4ee_2.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_445683ba-6ff5-42b6-8496-895c9b3ed4ee_3.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_46e72589-4a4e-473a-97a7-e3baef0ada27_0.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_46e72589-4a4e-473a-97a7-e3baef0ada27_1.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_46e72589-4a4e-473a-97a7-e3baef0ada27_2.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_46e72589-4a4e-473a-97a7-e3baef0ada27_3.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_6609f307-8a2c-4fd1-bbbf-3769e8be1eca_0.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_6609f307-8a2c-4fd1-bbbf-3769e8be1eca_1.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_6609f307-8a2c-4fd1-bbbf-3769e8be1eca_2.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_6609f307-8a2c-4fd1-bbbf-3769e8be1eca_3.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_683efc08-5e6f-4199-9335-e02ca1acd8ef_0.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_683efc08-5e6f-4199-9335-e02ca1acd8ef_1.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_683efc08-5e6f-4199-9335-e02ca1acd8ef_2.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_683efc08-5e6f-4199-9335-e02ca1acd8ef_3.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_6b0a1673-c0b2-4eb0-98e4-4fbac039724c_0.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_6b0a1673-c0b2-4eb0-98e4-4fbac039724c_1.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_6b0a1673-c0b2-4eb0-98e4-4fbac039724c_2.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_6b0a1673-c0b2-4eb0-98e4-4fbac039724c_3.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_7177b260-4622-4e98-8a92-b635a52962c1_0.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_7177b260-4622-4e98-8a92-b635a52962c1_1.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_7177b260-4622-4e98-8a92-b635a52962c1_2.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_7177b260-4622-4e98-8a92-b635a52962c1_3.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_77326f95-83d2-4dd7-9c5a-0eb82cc87103_0.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_77326f95-83d2-4dd7-9c5a-0eb82cc87103_1.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_77326f95-83d2-4dd7-9c5a-0eb82cc87103_2.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_77326f95-83d2-4dd7-9c5a-0eb82cc87103_3.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_b26a1cc2-234e-4173-8932-f880b916d29e_0.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_b26a1cc2-234e-4173-8932-f880b916d29e_1.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_b26a1cc2-234e-4173-8932-f880b916d29e_2.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_b26a1cc2-234e-4173-8932-f880b916d29e_3.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_d2f6a42b-9fa0-4193-bea5-250cbb736ace_0.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_d2f6a42b-9fa0-4193-bea5-250cbb736ace_1.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_d2f6a42b-9fa0-4193-bea5-250cbb736ace_2.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_d2f6a42b-9fa0-4193-bea5-250cbb736ace_3.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_d3e12350-7e94-4830-9703-88fb4fb63a96_0.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_d3e12350-7e94-4830-9703-88fb4fb63a96_1.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_d3e12350-7e94-4830-9703-88fb4fb63a96_2.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_d3e12350-7e94-4830-9703-88fb4fb63a96_3.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_db993c2d-5bd2-4e43-bacf-eb71c349b769_0.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_db993c2d-5bd2-4e43-bacf-eb71c349b769_1.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_db993c2d-5bd2-4e43-bacf-eb71c349b769_2.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_db993c2d-5bd2-4e43-bacf-eb71c349b769_3.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_ed98f4ad-6222-4439-8407-5c93d6ed538a_0.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_ed98f4ad-6222-4439-8407-5c93d6ed538a_1.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_ed98f4ad-6222-4439-8407-5c93d6ed538a_2.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_ed98f4ad-6222-4439-8407-5c93d6ed538a_3.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_f5e93809-6a21-4094-bf47-34eec6d1cef2_0.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_f5e93809-6a21-4094-bf47-34eec6d1cef2_1.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_f5e93809-6a21-4094-bf47-34eec6d1cef2_2.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_th_f5e93809-6a21-4094-bf47-34eec6d1cef2_3.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_the__0b00e323-4137-44b0-914c-c3a89e8b3b0f.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_the__0b00e323-4137-44b0-914c-c3a89e8b3b0f.webp',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_the__50e358ee-16df-4474-999d-aedb4118bd91.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_the__50e358ee-16df-4474-999d-aedb4118bd91.webp',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_the__b53afe4d-76ec-499a-be92-a58f65bbf7bd.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_the__b53afe4d-76ec-499a-be92-a58f65bbf7bd.webp',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_the__e9c05a6a-bcc1-4e7d-9908-90fe3ab11967.png',
  'imlunahey_the_number_of_times_a_tweet_has_been_shared_over_the__e9c05a6a-bcc1-4e7d-9908-90fe3ab11967.webp',
  'imlunahey_the_water_is_showing_some_pink_tints_in_the_style_o_0da1c8e2-a91f-4d85-8929-8635322dbef2_0.png',
  'imlunahey_the_water_is_showing_some_pink_tints_in_the_style_o_0da1c8e2-a91f-4d85-8929-8635322dbef2_1.png',
  'imlunahey_the_water_is_showing_some_pink_tints_in_the_style_o_0da1c8e2-a91f-4d85-8929-8635322dbef2_2.png',
  'imlunahey_the_water_is_showing_some_pink_tints_in_the_style_o_0da1c8e2-a91f-4d85-8929-8635322dbef2_3.png',
  'imlunahey_the_water_is_showing_some_pink_tints_in_the_style_o_11444df2-6dd4-4fb9-b33a-eda37e15f887_0.png',
  'imlunahey_the_water_is_showing_some_pink_tints_in_the_style_o_11444df2-6dd4-4fb9-b33a-eda37e15f887_1.png',
  'imlunahey_the_water_is_showing_some_pink_tints_in_the_style_o_11444df2-6dd4-4fb9-b33a-eda37e15f887_2.png',
  'imlunahey_the_water_is_showing_some_pink_tints_in_the_style_o_11444df2-6dd4-4fb9-b33a-eda37e15f887_3.png',
  'imlunahey_the_water_is_showing_some_pink_tints_in_the_style_o_6d10258c-9dee-42f4-b5d9-f11435ace8ad_0.png',
  'imlunahey_the_water_is_showing_some_pink_tints_in_the_style_o_6d10258c-9dee-42f4-b5d9-f11435ace8ad_1.png',
  'imlunahey_the_water_is_showing_some_pink_tints_in_the_style_o_6d10258c-9dee-42f4-b5d9-f11435ace8ad_2.png',
  'imlunahey_the_water_is_showing_some_pink_tints_in_the_style_o_6d10258c-9dee-42f4-b5d9-f11435ace8ad_3.png',
  'imlunahey_this_photo_shows_the_ripple_of_water_and_colorful_p_f49f5639-d7b8-4ba7-a5ee-92b9f411afb2_0.png',
  'imlunahey_this_photo_shows_the_ripple_of_water_and_colorful_p_f49f5639-d7b8-4ba7-a5ee-92b9f411afb2_1.png',
  'imlunahey_this_photo_shows_the_ripple_of_water_and_colorful_p_f49f5639-d7b8-4ba7-a5ee-92b9f411afb2_2.png',
  'imlunahey_this_photo_shows_the_ripple_of_water_and_colorful_p_f49f5639-d7b8-4ba7-a5ee-92b9f411afb2_3.png',
];

const loadImage = (src: string) => {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

export const ScreenshotTool = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [searchParams, setSearchParams] = useSearchParams<{
    backgroundType: 'colour' | 'gradient' | 'image' | 'transparent' | null;
    backgroundColour: string | null;
    backgroundGradient: string | null;
    backgroundImage: string | null;
    shadowColour: string;
    shadowScale: number;
    scale: number;
    cornerRadius: number;
    canvasRatio: CanvasRatio;
    frameColour: string;
    autoCenter: boolean;
    flareIntensity: number;
    flareColour: string;
    patternsGrid: boolean;
    patternsDot: boolean;
    patternsWaves: boolean;
    textToRender: string | null;
    fontSize: number;
    textPositionX: number;
    textPositionY: number;
    prime: boolean;
  }>();

  // Backgrounds
  const [backgroundType, setBackgroundType] = useState<'colour' | 'gradient' | 'image' | 'transparent' | null>(
    (searchParams.backgroundType as 'colour' | 'gradient' | 'image') ?? ('image' as const),
  );
  const [backgroundColour, setBackgroundColour] = useState<string | null>(
    searchParams.backgroundColour ? `#${searchParams.backgroundColour}` : null,
  );
  const [backgroundGradient, setbackgroundGradient] = useState<string[] | null>(
    searchParams.backgroundGradient?.split('-').map((value: string) => `#${value}`) ?? null,
  );
  const backgroundImage = useRef<HTMLImageElement | null>(null);
  const [backgroundImageSrc, setBackgroundImageSrc] = useState<string | null>(
    searchParams.backgroundImage ? Buffer.from(searchParams.backgroundImage, 'base64').toString('utf-8') : null,
  );

  // Config
  const [shadowColour, setShadowColour] = useState(searchParams.shadowColour ? `#${searchParams.shadowColour}` : '#000000');
  const [shadowScale, setShadowScale] = useState(searchParams.shadowScale ? Number(searchParams.shadowScale) : 0);
  const [scale, setScale] = useState(searchParams.scale ? Number(searchParams.scale) : 100);
  const [cornerRadius, setCornerRadius] = useState(searchParams.cornerRadius ? Number(searchParams.cornerRadius) : 20);
  const [canvasRatio, setCanvasRatio] = useState<CanvasRatio>((searchParams.canvasRatio as CanvasRatio) ?? '16:9');
  const [frameColour, setFrameColour] = useState<string>(
    searchParams.frameColour ? `#${searchParams.frameColour}` : '#FFFFFF',
  );
  const [autoCenter, setAutoCenter] = useState(searchParams.autoCenter === 'true');
  const [flareIntensity, setFlareIntensity] = useState(
    searchParams.flareIntensity ? Number(searchParams.flareIntensity) : 0,
  );
  const [flareColour, setFlareColour] = useState(searchParams.flareColour ? `#${searchParams.flareColour}` : '#FFFFFF');
  const [patterns, setPatterns] = useState<{
    grid: boolean;
    dot: boolean;
    waves: boolean;
  }>({
    grid: searchParams.patternsGrid === 'true',
    dot: searchParams.patternsDot === 'true',
    waves: searchParams.patternsWaves === 'true',
  });
  const [textToRender, setTextToRender] = useState<string | null>(searchParams.textToRender ?? null);
  const [fontSize, setFontSize] = useState(searchParams.fontSize ? Number(searchParams.fontSize) : 100);
  const [textPositionX, setTextPositionX] = useState(searchParams.textPositionX ? Number(searchParams.textPositionX) : 0);
  const [textPositionY, setTextPositionY] = useState(searchParams.textPositionY ? Number(searchParams.textPositionY) : 0);
  const [stackCount, setStackCount] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [imageFlip, _setImageFlip] = useState({
    horizontal: false,
    vertical: false,
  });
  const [imageRotation, setImageRotation] = useState(0);

  // User uploaded image
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  // Internal Controls
  const isDragging = useRef(false);
  const dragStart = useRef<Position>({ x: 0, y: 0 });
  const position = useRef<Position>({ x: 0, y: 0 });
  const requestRef = useRef<number | null>(null);
  const [showDropzone, setShowDropzone] = useState(false);
  const images = useRef<HTMLImageElement[]>([]);

  // Easter eggs
  const prime = searchParams.prime === 'agen';

  useEffect(() => {
    if (!image && prime) {
      const image = new Image();
      image.src = '/easter-eggs/prime.jpg';
      image.onload = () => {
        setImage(image);
      };
    }
  });

  // When config changes, update the URL
  useEffect(() => {
    setSearchParams({
      backgroundType,
      backgroundColour: backgroundColour ? backgroundColour.slice(1) : null,
      backgroundGradient: backgroundGradient?.map((value) => value.slice(1))?.join('-') ?? null,
      backgroundImage: backgroundImageSrc ? Buffer.from(backgroundImageSrc).toString('base64') : null,
      shadowColour: shadowColour.slice(1),
      shadowScale,
      scale,
      cornerRadius,
      canvasRatio,
      frameColour: frameColour.slice(1),
      autoCenter,
      flareIntensity,
      flareColour: flareColour.slice(1),
      patternsDot: patterns.dot,
      patternsGrid: patterns.grid,
      patternsWaves: patterns.waves,
      textToRender,
      fontSize,
      textPositionX,
      textPositionY,
      prime,
    });
  }, [
    backgroundColour,
    backgroundGradient,
    backgroundImageSrc,
    shadowColour,
    shadowScale,
    scale,
    backgroundType,
    cornerRadius,
    canvasRatio,
    frameColour,
    autoCenter,
    flareIntensity,
    flareColour,
    patterns,
    setSearchParams,
    textToRender,
    fontSize,
    textPositionX,
    textPositionY,
    imageFlip,
    imageRotation,
    prime,
  ]);

  useEffect(() => {
    // Preload the images
    images.current = imageFileNames
      .sort(() => Math.random() - 0.5)
      .slice(0, 20)
      .map((src) => {
        const image = new Image();
        image.src = `/backgrounds/${src}`;
        return image;
      });
  }, []);

  useEffect(() => {
    // Generate a random background colour
    if (backgroundColour === null) {
      const newBackgroundColour = generateColor();
      setBackgroundColour(newBackgroundColour);
    }

    // Generate a random background gradient
    if (backgroundGradient === null) {
      const newbackgroundGradient = Array.from({ length: 3 }, () => generateColor());
      setbackgroundGradient(newbackgroundGradient);
    }

    // Randomly select a background image
    if (backgroundImage.current === null) {
      const randomIndex = Math.floor(Math.random() * images.current.length);
      const image = images.current[randomIndex];
      backgroundImage.current = image;
      setBackgroundImageSrc(image.src);
    }
  }, [backgroundColour, backgroundGradient]);

  const handleChangeBackground = (color: string) => {
    setBackgroundColour(color);
  };
  const getPrimaryColorsFromCanvas = (canvas: HTMLCanvasElement) => {
    // Create a temporary canvas to downsample the image
    const tempCanvas = document.createElement('canvas');
    const tempContext = tempCanvas.getContext('2d');
    tempCanvas.width = 100;
    tempCanvas.height = 100;

    // Check if context is available
    if (!tempContext) return [[0, 0, 0]];

    // Draw the original canvas onto the temporary canvas, resizing it to 100x100
    tempContext.drawImage(canvas, 0, 0, 100, 100);

    // Use the downsized image for color extraction
    const imageData = tempContext.getImageData(0, 0, 100, 100);
    const data = imageData.data;

    const colorMap: {
      [key: string]: number;
    } = {};

    // Iterate over every pixel to count the occurrence of each color
    for (let i = 0; i < data.length; i += 4 * 4) {
      // Convert the RGB to a string to use as a key (ignoring alpha channel)
      const color = `${data[i]}-${data[i + 1]}-${data[i + 2]}`;

      if (colorMap[color]) {
        colorMap[color]++;
      } else {
        colorMap[color] = 1;
      }
    }

    // Determine the most frequent colors
    const coloursByFrequency = Object.keys(colorMap).sort((a, b) => colorMap[b] - colorMap[a]);

    // Return the most frequent colors as an array of RGB values
    // E.g. [[255, 255, 255], [0, 0, 0]]
    return coloursByFrequency.map((colour) => colour.split('-').map((num) => parseInt(num, 10)));
  };

  // Timeout ref for gif frames
  const gifFrameTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // @TODO: make this not shit 'cause its really bad code
  const handleFrameData = (frameData: FrameData[]) => {
    let frameIndex = 0;
    // @TODO: make this not shit 'cause its really bad code
    const updateNextGifFrame = () => {
      if (frameIndex >= frameData.length) {
        frameIndex = 0;
      }
      const frame = frameData[frameIndex++].getImage();
      setImage(frame);

      gifFrameTimeoutRef.current = setTimeout(() => {
        updateNextGifFrame();
      }, frameData[frameIndex++].frameInfo.delay * 10);
    };

    updateNextGifFrame();
  };

  const onDrop = useCallback(
    (file: File[]) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      loadImage(URL.createObjectURL(file[0])).then((loadedImage) => {
        if (file[0].type === 'image/gif') {
          gifFrames({ url: loadedImage.src, frames: 'all', outputType: 'canvas', cumulative: true }).then(handleFrameData);
        } else {
          if (gifFrameTimeoutRef.current) {
            clearTimeout(gifFrameTimeoutRef.current);
          }
        }

        setImage(loadedImage);
        centerImage(canvasRef as RefObject<HTMLCanvasElement>, loadedImage, scale, position);

        const imageCanvas = document.createElement('canvas');
        imageCanvas.width = loadedImage.width;
        imageCanvas.height = loadedImage.height;
        const context = imageCanvas.getContext('2d');
        if (!context) return;

        context.drawImage(loadedImage, 0, 0);
        const colours = getPrimaryColorsFromCanvas(imageCanvas);
        const gradientColours = colours.map((colour) => rgbaToHex(`rgb(${colour[0]}, ${colour[1]}, ${colour[2]})`));

        setBackgroundColour(gradientColours[0]);
        setbackgroundGradient([
          gradientColours[0],
          gradientColours[Math.floor(gradientColours.length * 0.5)],
          gradientColours[gradientColours.length - 1],
        ]);
      });
    },
    [scale],
  );

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    event.preventDefault();
    if (canvasRef.current) {
      // Get the displayed size of the canvas
      const rect = canvasRef.current.getBoundingClientRect();

      // Calculate the scaling factors based on the canvas size and displayed size
      const scaleX = canvasRef.current.width / rect.width;
      const scaleY = canvasRef.current.height / rect.height;

      // Adjust the initial drag position to account for the scaling
      // This calculates the "true" starting point considering the canvas scaling
      dragStart.current = {
        x: (event.touches[0].clientX - rect.left) * scaleX - position.current.x,
        y: (event.touches[0].clientY - rect.top) * scaleY - position.current.y,
      };

      // Set the dragging flag
      isDragging.current = true;

      // Stop auto centering
      setAutoCenter(false);
    }
  }, []);

  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    event.preventDefault();
    if (isDragging.current && canvasRef.current) {
      // Get the displayed size of the canvas
      const rect = canvasRef.current.getBoundingClientRect();

      // Calculate the scaling factors
      const scaleX = canvasRef.current.width / rect.width;
      const scaleY = canvasRef.current.height / rect.height;

      // Adjust the mouse coordinates with the scaling factor
      // Note: `clientX` and `clientY` are the mouse positions from the event
      const adjustedX = (event.touches[0].clientX - rect.left) * scaleX - dragStart.current.x;
      const adjustedY = (event.touches[0].clientY - rect.top) * scaleY - dragStart.current.y;

      // Update the position taking into account the scaling
      position.current = { x: adjustedX, y: adjustedY };
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (canvasRef.current) {
      // Get the displayed size of the canvas
      const rect = canvasRef.current.getBoundingClientRect();

      // Calculate the scaling factors based on the canvas size and displayed size
      const scaleX = canvasRef.current.width / rect.width;
      const scaleY = canvasRef.current.height / rect.height;

      // Adjust the initial drag position to account for the scaling
      // This calculates the "true" starting point considering the canvas scaling
      dragStart.current = {
        x: (event.clientX - rect.left) * scaleX - position.current.x,
        y: (event.clientY - rect.top) * scaleY - position.current.y,
      };

      // Set the dragging flag
      isDragging.current = true;

      // Stop auto centering
      setAutoCenter(false);
    }
  }, []);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (isDragging.current && canvasRef.current) {
      // Get the displayed size of the canvas
      const rect = canvasRef.current.getBoundingClientRect();

      // Calculate the scaling factors
      const scaleX = canvasRef.current.width / rect.width;
      const scaleY = canvasRef.current.height / rect.height;

      // Adjust the mouse coordinates with the scaling factor
      // Note: `clientX` and `clientY` are the mouse positions from the event
      const adjustedX = (event.clientX - rect.left) * scaleX - dragStart.current.x;
      const adjustedY = (event.clientY - rect.top) * scaleY - dragStart.current.y;

      // Update the position taking into account the scaling
      position.current = { x: adjustedX, y: adjustedY };
    }
  }, []);

  // Reset the dragging flag when the mouse is released
  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Redraw the canvas when anything changes
  useEffect(() => {
    const redraw = () => {
      // Center the image if auto center is enabled
      if (image && autoCenter) {
        centerImage(canvasRef as RefObject<HTMLCanvasElement>, image, scale, position);
      }

      draw({
        canvas: canvasRef.current,
        image,
        position: position.current,
        shadowBlur: shadowScale,
        scale,
        shadowColour,
        backgroundType,
        backgroundColour,
        backgroundGradient,
        backgroundImage: backgroundImage.current,
        cornerRadius,
        frameColour,
        flareIntensity,
        flareColour,
        patterns,
        textToRender,
        fontSize,
        textPositionX,
        textPositionY,
        stackCount,
        imageFlip,
        imageRotation,
        autoCenter,
      });
      requestRef.current = requestAnimationFrame(redraw);
    };
    requestRef.current = requestAnimationFrame(redraw);
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [
    backgroundType,
    backgroundColour,
    backgroundGradient,
    backgroundImage,
    image,
    shadowScale,
    scale,
    shadowColour,
    cornerRadius,
    frameColour,
    canvasRef.current?.width,
    canvasRef.current?.height,
    autoCenter,
    patterns,
    flareIntensity,
    flareColour,
    textToRender,
    fontSize,
    textPositionX,
    textPositionY,
    stackCount,
    imageFlip,
    imageRotation,
  ]);

  // Add event listeners for mouse up and mouse leave
  useEffect(() => {
    const handleMouseLeave = () => {
      isDragging.current = false;
    };
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [handleMouseUp]);

  const canvasSize = canvasRatioToSize(canvasRatio);
  const canvasWidth = canvasSize?.width ?? 1920;
  const canvasHeight = canvasSize?.height ?? 1080;

  const mainCanvas = (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={canvasHeight}
      className="h-full w-full object-contain"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    />
  );
  const randomBackgroundButton = (
    <Button
      disabled={backgroundType === 'transparent'}
      onClick={() => {
        // Generate a random background colour
        if (backgroundType === 'colour') {
          const newBackgroundColour = generateColor();
          setBackgroundColour(newBackgroundColour);
        }

        // Generate a random gradient
        if (backgroundType === 'gradient') {
          const newbackgroundGradient = Array.from({ length: 3 }, () => generateColor());
          setbackgroundGradient(newbackgroundGradient);
        }

        // Randomly select a background image
        if (backgroundType === 'image') {
          const randomIndex = Math.floor(Math.random() * images.current.length);
          const image = images.current[randomIndex];
          backgroundImage.current = image;
          setBackgroundImageSrc(image.src);
        }
      }}
    >
      <RefreshIcon />
    </Button>
  );
  const backgroundTypeButtons = (
    <div className="flex flex-row gap-2">
      <Button active={backgroundType === 'colour'} onClick={() => setBackgroundType('colour')}>
        Colour
      </Button>
      <Button active={backgroundType === 'gradient'} onClick={() => setBackgroundType('gradient')}>
        Gradient
      </Button>
      <Button active={backgroundType === 'image'} onClick={() => setBackgroundType('image')}>
        Image
      </Button>
      <Button active={backgroundType === 'transparent'} onClick={() => setBackgroundType('transparent')}>
        Transparent
      </Button>
      {randomBackgroundButton}
    </div>
  );
  const backgroundColourPicker = (
    <BackgroundColourPicker backgroundColour={backgroundColour} onChangeBackgroundColour={handleChangeBackground} />
  );
  const backgroundGradientPicker = (
    <GradientPicker
      backgroundGradient={backgroundGradient}
      onChange={(newbackgroundGradient) => {
        setbackgroundGradient(newbackgroundGradient);
      }}
    />
  );
  const backgroundImagePicker = (
    <div className="flex flex-col gap-2">
      <label htmlFor="background-image-picker">Image</label>
      <div className="grid grid-cols-5 gap-2">
        {images.current.map((image, index) => (
          <Button
            key={index}
            className="p-0"
            onClick={() => {
              backgroundImage.current = image;
              setBackgroundImageSrc(image?.src ?? null);
            }}
          >
            <img
              src={image.src}
              alt={`Background image #${index}`}
              className={cn('h-[48px] w-[48px] object-cover', {
                'border border-black dark:border-white': backgroundImageSrc === image.src,
              })}
            />
          </Button>
        ))}
      </div>
    </div>
  );

  const imageRotationButtons = (
    <div className="flex flex-row gap-2">
      <Button
        onClick={() => {
          setImage((image) => {
            if (!image) return null;
            return flipImage({
              image,
              imageFlip: {
                horizontal: true,
                vertical: false,
              },
              imageRotation,
            });
          });
        }}
      >
        <FlipHorizontalIcon />
      </Button>
      <Button
        onClick={() => {
          setImage((image) => {
            if (!image) return null;
            return flipImage({
              image,
              imageFlip: {
                horizontal: false,
                vertical: true,
              },
              imageRotation,
            });
          });
        }}
      >
        <FlipVerticalIcon />
      </Button>
      <Button
        onClick={(e) => {
          e.preventDefault();
          setImageRotation((imageRotation) => {
            return imageRotation + 10;
          });
        }}
      >
        <RotateIcon rotation={imageRotation} />
      </Button>
      <Button
        onClick={(e) => {
          e.preventDefault();
          setImageRotation((imageRotation) => {
            return imageRotation - 10;
          });
        }}
      >
        <RotateIcon rotation={imageRotation} className="scale-x-[-1]" />
      </Button>
    </div>
  );
  const shadowColourPicker = (
    <div className="flex flex-row justify-between gap-2">
      <label htmlFor="shadow-colour-picker">Shadow Colour</label>
      <input
        id="shadow-colour-picker"
        type="color"
        value={shadowColour}
        onChange={(event) => setShadowColour(event.target.value)}
      />
    </div>
  );
  const shadowSizeSlider = (
    <SlideyBoi
      id="shadow-size-slider"
      label="Shadow Size"
      type="range"
      min="0"
      max="100"
      value={shadowScale}
      onChange={(event) => setShadowScale(Number(event.target.value))}
    />
  );
  const cornerRadiusSlider = (
    <SlideyBoi
      id="corner-radius-slider"
      label="Corner Radius"
      type="range"
      min="0"
      max="50"
      value={cornerRadius}
      onChange={(event) => setCornerRadius(Number(event.target.value))}
    />
  );

  const canvasRatioSelector = (
    <PickyPal
      id="canvas-ratio-selector"
      label="Canvas Ratio"
      value={canvasRatio}
      onChange={(event) => setCanvasRatio(event.target.value as CanvasRatio)}
      options={Object.entries(canvasRatios).map(([canvasRatio, { name }]) => ({
        key: name,
        value: canvasRatio,
      }))}
    />
  );

  const frameColours = [
    {
      name: 'None',
      colour: '',
    },
    {
      name: 'Black',
      colour: '#000000',
    },
    {
      name: 'White',
      colour: '#FFFFFF',
    },
  ];
  const frameColourPicker = (
    <PickyPal
      id="frame-colour-picker"
      label="Frame Colour"
      value={frameColour}
      onChange={(event) => setFrameColour(event.target.value)}
      options={frameColours.map(({ name, colour }) => ({
        key: name,
        value: colour,
      }))}
    />
  );
  const flareColourPicker = (
    <div className="flex flex-row justify-between gap-2">
      <label htmlFor="flare-colour-picker">Flare Colour</label>
      <input
        id="flare-colour-picker"
        type="color"
        value={flareColour}
        onChange={(event) => setFlareColour(event.target.value)}
      />
    </div>
  );
  const flareIntensitySlider = (
    <SlideyBoi
      id="flare-intensity-slider"
      label="Flare Intensity"
      type="range"
      min="0"
      max="1000"
      value={flareIntensity}
      onChange={(event) => setFlareIntensity(Number(event.target.value))}
    />
  );
  const patternPicker = (
    <div className="flex flex-row justify-between gap-2">
      <label htmlFor="pattern-picker">Pattern</label>
      <div className="flex flex-row gap-1">
        <div className="flex flex-row justify-between gap-2">
          <input
            id="grid"
            type="checkbox"
            checked={patterns.grid}
            onChange={(event) => setPatterns({ ...patterns, grid: event.target.checked })}
          />
          <label htmlFor="grid">Grid</label>
        </div>
        <div className="flex flex-row justify-between gap-2">
          <input
            id="dot"
            type="checkbox"
            checked={patterns.dot}
            onChange={(event) => setPatterns({ ...patterns, dot: event.target.checked })}
          />
          <label htmlFor="dot">Dot</label>
        </div>
        <div className="flex flex-row justify-between gap-2">
          <input
            id="waves"
            type="checkbox"
            checked={patterns.waves}
            onChange={(event) => setPatterns({ ...patterns, waves: event.target.checked })}
          />
          <label htmlFor="waves">Waves</label>
        </div>
      </div>
    </div>
  );
  const textToRenderInput = (
    <div className="flex flex-row justify-between gap-2">
      <label htmlFor="text-to-render-input">Text</label>
      <input
        id="text-to-render-input"
        autoComplete="off"
        className="rounded-sm border border-[#e4e4e7] bg-[#f1f1f3] px-2 py-1 text-[#2e2e2e] dark:border-[#2e2e2e] dark:bg-[#222327] dark:text-[#f1f1f3]"
        type="text"
        value={textToRender ?? ''}
        onChange={(event) => setTextToRender(event.target.value)}
      />
    </div>
  );
  const textPositionXSlider = (
    <SlideyBoi
      id="text-position-x"
      label="Text Position X"
      type="range"
      min={-canvasWidth / 2}
      max={canvasWidth / 2}
      value={textPositionX}
      onChange={(event) => setTextPositionX(Number(event.target.value))}
    />
  );
  const textPositionYSlider = (
    <SlideyBoi
      id="text-position-y"
      label="Text Position Y"
      min={-canvasHeight / 2}
      max={canvasHeight / 2}
      value={textPositionY}
      onChange={(event) => setTextPositionY(Number(event.target.value))}
    />
  );
  const fontSizeSlider = (
    <SlideyBoi
      id="font-size-slider"
      label="Font Size"
      type="range"
      min="1"
      max="100"
      value={fontSize}
      onChange={(event) => setFontSize(Number(event.target.value))}
    />
  );
  const imageSizeSlider = (
    <SlideyBoi
      id="image-size-slider"
      label="Image Size"
      type="range"
      min="1"
      max="100"
      value={scale}
      onChange={(event) => setScale(Number(event.target.value))}
    />
  );
  const centerImageButton = (
    <Button
      onClick={() => {
        if (!image) return;
        centerImage(canvasRef as RefObject<HTMLCanvasElement>, image, scale, position);
        setAutoCenter(true);
      }}
    >
      Center Image
    </Button>
  );
  const stacksSlider = (
    <SlideyBoi
      id="stacks-slider"
      label="Stacks"
      type="range"
      min="0"
      max="10"
      value={stackCount}
      onChange={(event) => setStackCount(Number(event.target.value))}
    />
  );
  const downloadButton = (
    <div className="flex flex-row gap-2">
      <DownloadCanvasButton canvasRef={canvasRef as RefObject<HTMLCanvasElement>} type="png" className="p-2" />
      <DownloadCanvasButton canvasRef={canvasRef as RefObject<HTMLCanvasElement>} type="jpeg" className="p-2" />
      <DownloadCanvasButton canvasRef={canvasRef as RefObject<HTMLCanvasElement>} type="webp" className="p-2" />
    </div>
  );
  const dropzone = <Dropzone onDrop={onDrop} />;

  // Image sidebar
  const imageSidebar: (false | (false | React.ReactNode)[])[] = [
    // Flip
    [imageRotationButtons],

    // Shadow
    [shadowColourPicker, shadowSizeSlider],

    // Corner radius
    [cornerRadiusSlider],

    // Frame colour
    [frameColourPicker],

    // Image position
    [imageSizeSlider, centerImageButton],

    // Stacks
    [stacksSlider],
  ];

  // Canvas sidebar
  const canvasSidebar: (false | (false | React.ReactNode)[])[] = [
    // Background type
    [backgroundTypeButtons],

    // Background types
    backgroundType !== 'transparent' && [
      backgroundType === 'colour' && backgroundColourPicker,
      backgroundType === 'gradient' && backgroundGradientPicker,
      backgroundType === 'image' && backgroundImagePicker,
    ],

    // Canvas ratio
    [canvasRatioSelector],

    // Flare
    [flareColourPicker, flareIntensitySlider],

    // Pattern
    [patternPicker],

    // Text styling
    [textToRenderInput, textPositionXSlider, textPositionYSlider, fontSizeSlider],
  ];

  // Meta sidebar
  const metaSidebar: (false | (false | React.ReactNode)[])[] = [
    // Download
    [downloadButton],
  ];

  const canShowDropzone = !image || showDropzone;

  return (
    <div
      className="flex h-dvh flex-row justify-center gap-2 overflow-y-hidden p-4 text-black"
      onDragEnter={() => {
        setShowDropzone(true);
      }}
      onDrop={() => {
        setShowDropzone(false);
      }}
    >
      {!canShowDropzone && (
        <div className="flex h-dvh min-w-[360px] flex-col gap-2 overflow-y-scroll">
          <Sidebar name="Image settings" disabled={!!image} groups={imageSidebar} />
          <Sidebar name="Canvas settings" disabled={!!image} groups={canvasSidebar} />
          <Sidebar name="Meta" disabled={!!image} groups={metaSidebar} />
        </div>
      )}

      <div>
        <div className="relative flex items-center justify-center p-2">
          {canShowDropzone && dropzone}
          <div className="h-[calc(100dvh-3rem)] w-full">{mainCanvas}</div>
        </div>
      </div>
    </div>
  );
};
