import { cn } from '../../../../cn';

type ImageIconProps = {
  className?: string;
};

export const ImageIcon = ({ className }: ImageIconProps) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      viewBox="0 0 24 24"
      className={cn('h-6 w-6 fill-white stroke-black dark:fill-black dark:stroke-white', className)}
    >
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M14.264 15.938l-1.668-1.655c-.805-.798-1.208-1.197-1.67-1.343a2 2 0 00-1.246.014c-.458.155-.852.563-1.64 1.379L4.045 18.28m10.22-2.343l.341-.338c.806-.8 1.21-1.199 1.671-1.345a2 2 0 011.248.015c.458.156.852.565 1.64 1.382l.836.842m-5.736-.555l4.011 4.018m0 0c-.357.044-.82.044-1.475.044H7.2c-1.12 0-1.68 0-2.108-.218a2 2 0 01-.874-.874 1.845 1.845 0 01-.174-.628m14.231 1.676a1.85 1.85 0 00.633-.174 2 2 0 00.874-.874C20 18.48 20 17.92 20 16.8v-.307M4.044 18.28C4 17.922 4 17.457 4 16.8V7.2c0-1.12 0-1.68.218-2.108a2 2 0 01.874-.874C5.52 4 6.08 4 7.2 4h9.6c1.12 0 1.68 0 2.108.218a2 2 0 01.874.874C20 5.52 20 6.08 20 7.2v9.293M17 9a2 2 0 11-4 0 2 2 0 014 0z"
      ></path>
    </svg>
  );
};
