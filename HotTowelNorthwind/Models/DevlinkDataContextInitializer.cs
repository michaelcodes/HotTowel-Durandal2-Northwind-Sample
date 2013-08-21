using System;
using System.Collections.Generic;
using System.Data.Entity;
using System.Linq;
using System.Text;

namespace Devlink.Models
{
    public class DevlinkDataContextInitializer : DropCreateDatabaseAlways<DevlinkDataContext>
    {
        protected override void Seed(DevlinkDataContext context)
        {
            base.Seed(context);

            var cust = context.Customers.Add(new Customer
            {
                Name = "Wile E. Coyote",
                ShippingAddresses = new List<ShippingAddress>()
            });
            
            cust.ShippingAddresses.Add(new ShippingAddress
            {
                AddressLine1 = "Cactus 1",
                City = "Desert",
                State = "AZ"
            });

            context.Customers.Add(new Customer
            {
                Name = "Elmer Fudd",
            });

            context.Customers.Add(new Customer
            {
                Name = "Sylvester the Cat",
            });

            context.Customers.Add(new Customer
            {
                Name = "Dr. Doofenshmirtz",
            });

        }
    }
}
