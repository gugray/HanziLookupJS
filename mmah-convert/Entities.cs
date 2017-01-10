using System.Collections.Generic;

namespace MmahConvert
{
    public struct Point
    {
        public int X;
        public int Y;
    }

    public class SubStroke
    {
        public double Dir;
        public double Len;
        public double CenterX;
        public double CenterY;
    }

    public class Stroke
    {
        public List<Point> Points = new List<Point>();
    }
}
