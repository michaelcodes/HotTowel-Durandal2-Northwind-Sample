using System;
using System.Data.Entity;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Runtime.Serialization;
using System.Data.Objects;
using System.Data.Entity.Infrastructure;
using System.ComponentModel.DataAnnotations.Schema;

namespace HotTowelNorthwind.Models
{
    public class NorthwindContext : DbContext
    {
        public NorthwindContext() : base("name=NorthwindDB") {}

        public DbSet<Customer> Customers { get; set; }
        public DbSet<Order> Orders { get; set; }
        public DbSet<OrderDetail> OrderDetails { get; set; }
        public DbSet<Product> Products { get; set; }
    }

    [Table("Customers")]
    public class Customer
    {
        public string CustomerID { get; set; }
        public string CompanyName { get; set; }
        public string ContactName { get; set; }
        public string ContactTitle { get; set; }
        public string Address { get; set; }
        public string City { get; set; }
        public string Region { get; set; }
        public string PostalCode { get; set; }
        public string Country { get; set; }
        public string Phone { get; set; }
        public string Fax { get; set; }
        public virtual ICollection<Order> Orders { get; set; }
    }

    [Table("Order Details")]
    public class OrderDetail : IValidatableObject
    {
        [Key]
        public int OrderDetailsID { get; set; }
        //[Key, Column(Order = 1)]
        public int OrderID { get; set; }
        //[Key, Column(Order = 2)]
        public int ProductID { get; set; }
        public decimal UnitPrice { get; set; }
        public short Quantity { get; set; }
        public float Discount { get; set; }
        public Order Orders { get; set; }
        [ForeignKey("ProductID")]
        public virtual Product Product { get; set; }

        // Validate for the Discount property.
        public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
        {

            if (Discount < 0 || Discount > 1)
            {
                yield return new ValidationResult
                 ("Discount must be a value between zero and one", new[] { "Discount" });
            }
        }
    }

    [Table("Orders")]
    public class Order
    {
        public int OrderID { get; set; }
        public string CustomerID { get; set; }
        public int? EmployeeID { get; set; }
        public DateTime? OrderDate { get; set; }
        public DateTime? RequiredDate { get; set; }
        public DateTime? ShippedDate { get; set; }
        public decimal? Freight { get; set; }
        public string ShipName { get; set; }
        public string ShipAddress { get; set; }
        public string ShipCity { get; set; }
        public string ShipRegion { get; set; }
        public string ShipPostalCode { get; set; }
        public string ShipCountry { get; set; }
        [ForeignKey("CustomerID")]
        public virtual Customer Customer { get; set; }
        public virtual ICollection<OrderDetail> OrderDetails { get; set; }
    }

    [Table("Products")]
    public class Product
    {
        public int ProductID { get; set; }
        public string ProductName { get; set; }
        public string QuantityPerUnit { get; set; }
        public decimal? UnitPrice { get; set; }
        public short? UnitsInStock { get; set; }
        public short? UnitsOnOrder { get; set; }
        public short? ReorderLevel { get; set; }
        public bool Discontinued { get; set; }
    }
}