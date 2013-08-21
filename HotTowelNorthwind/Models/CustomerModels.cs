using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace Devlink.Models
{


    public class Customer
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string AddressLine1 { get; set; }
        public string AddressLine2 { get; set; }
        public string City { get; set; }
        public string State { get; set; }
        public string PostalCode { get; set; }
        public string Phone { get; set; }
        public string Contact { get; set; }
        public ICollection<Note> Notes { get; set; }
        public ICollection<ShippingAddress> ShippingAddresses { get; set; }
    }

    public class Note
    {
        public int Id { get; set; }
        public string CreatedDate { get; set; }
        public string Contents { get; set; }
    }

    public class BillingAddress
    {
        public string CustomerName { get; set; }
        public string AddressLine1 { get; set; }
        public string AddressLine2 { get; set; }
        public string City { get; set; }
        public string State { get; set; }
        public string PostalCode { get; set; }
        public string Phone { get; set; }
        public string Contact { get; set; }
    }

    public class ShippingAddress
    {
        public int Id { get; set; }
        public string AddressLine1 { get; set; }
        public string AddressLine2 { get; set; }
        public string City { get; set; }
        public string State { get; set; }
        public string PostalCode { get; set; }
        public string Attention { get; set; }
        public string ShipToName { get; set; }
        public string Phone { get; set; }
        public string Contact { get; set; }
    }

    public class Contact
    {
        public int Id { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string Email { get; set; }
        public string PhoneWork { get; set; }
        public string PhoneMobile { get; set; }
        public string Fax { get; set; }
        public bool IsPrimary { get; set; }

    }
}