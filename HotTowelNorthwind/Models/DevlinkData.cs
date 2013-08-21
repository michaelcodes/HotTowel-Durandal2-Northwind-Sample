using System;
using System.Collections.Generic;
using System.Data.Entity;
using System.Linq;
using System.Web;

namespace Devlink.Models
{
    public class DevlinkDataContext: DbContext
    {
        public DbSet<Customer> Customers { get; set; }
        public DbSet<ShippingAddress> ShippingAddresses { get; set; }
        public DbSet<Note> Notes { get; set; }

        public DevlinkDataContext()
        {
            Database.SetInitializer<DevlinkDataContext>(new DevlinkDataContextInitializer());
        }
    }
}